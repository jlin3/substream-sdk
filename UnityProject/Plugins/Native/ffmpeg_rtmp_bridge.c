/**
 * FFmpeg RTMP Bridge - Native Implementation
 * 
 * Uses FFmpeg libraries for H.264 encoding and RTMPS streaming.
 * 
 * Required FFmpeg libraries:
 * - libavcodec (encoding)
 * - libavformat (muxing/RTMP)
 * - libavutil (utilities)
 * - libswscale (color conversion)
 * - libswresample (audio resampling)
 */

#include "ffmpeg_rtmp_bridge.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

// FFmpeg headers
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/opt.h>
#include <libavutil/imgutils.h>
#include <libavutil/time.h>
#include <libswscale/swscale.h>
#include <libswresample/swresample.h>

// Thread safety
#ifdef _WIN32
#include <windows.h>
#define MUTEX_TYPE CRITICAL_SECTION
#define MUTEX_INIT(m) InitializeCriticalSection(&m)
#define MUTEX_LOCK(m) EnterCriticalSection(&m)
#define MUTEX_UNLOCK(m) LeaveCriticalSection(&m)
#define MUTEX_DESTROY(m) DeleteCriticalSection(&m)
#else
#include <pthread.h>
#define MUTEX_TYPE pthread_mutex_t
#define MUTEX_INIT(m) pthread_mutex_init(&m, NULL)
#define MUTEX_LOCK(m) pthread_mutex_lock(&m)
#define MUTEX_UNLOCK(m) pthread_mutex_unlock(&m)
#define MUTEX_DESTROY(m) pthread_mutex_destroy(&m)
#endif

// Global state
static struct {
    RTMPState state;
    RTMPConfig config;
    char error_msg[512];
    
    // FFmpeg contexts
    AVFormatContext* format_ctx;
    AVCodecContext* video_codec_ctx;
    AVCodecContext* audio_codec_ctx;
    AVStream* video_stream;
    AVStream* audio_stream;
    
    // Scaling/conversion
    struct SwsContext* sws_ctx;
    struct SwrContext* swr_ctx;
    
    // Frames and packets
    AVFrame* video_frame;
    AVFrame* audio_frame;
    AVPacket* packet;
    
    // Statistics
    int64_t bytes_sent;
    int frames_sent;
    int dropped_frames;
    int64_t start_time;
    
    // Thread safety
    MUTEX_TYPE mutex;
    int mutex_initialized;
    
} g_rtmp = {0};

// Helper macros
#define SET_ERROR(fmt, ...) snprintf(g_rtmp.error_msg, sizeof(g_rtmp.error_msg), fmt, ##__VA_ARGS__)
#define CHECK_STATE(expected) if (g_rtmp.state != expected) { SET_ERROR("Invalid state: expected %d, got %d", expected, g_rtmp.state); return RTMP_ERROR_NOT_CONNECTED; }

// Forward declarations
static int init_video_encoder(void);
static int init_audio_encoder(void);
static int encode_and_send_video(const uint8_t* rgba_data, int64_t pts);
static int encode_and_send_audio(const float* pcm_data, int num_samples, int64_t pts);

RTMP_API int rtmp_init(const RTMPConfig* config) {
    if (config == NULL) {
        SET_ERROR("Config is NULL");
        return RTMP_ERROR_INVALID_PARAMS;
    }
    
    return rtmp_init_simple(
        config->width,
        config->height,
        config->fps,
        config->bitrate_kbps,
        config->keyframe_interval,
        config->audio_sample_rate,
        config->audio_channels,
        config->audio_bitrate_kbps
    );
}

RTMP_API int rtmp_init_simple(
    int width, 
    int height, 
    int fps, 
    int bitrate_kbps,
    int keyframe_interval,
    int audio_sample_rate,
    int audio_channels,
    int audio_bitrate_kbps
) {
    // Validate parameters
    if (width <= 0 || height <= 0 || fps <= 0 || bitrate_kbps <= 0) {
        SET_ERROR("Invalid video parameters: %dx%d @ %dfps, %dkbps", width, height, fps, bitrate_kbps);
        return RTMP_ERROR_INVALID_PARAMS;
    }
    
    // Initialize mutex
    if (!g_rtmp.mutex_initialized) {
        MUTEX_INIT(g_rtmp.mutex);
        g_rtmp.mutex_initialized = 1;
    }
    
    MUTEX_LOCK(g_rtmp.mutex);
    
    // Clean up any existing state
    if (g_rtmp.state != RTMP_STATE_IDLE) {
        MUTEX_UNLOCK(g_rtmp.mutex);
        rtmp_cleanup();
        MUTEX_LOCK(g_rtmp.mutex);
    }
    
    // Store configuration
    g_rtmp.config.width = width;
    g_rtmp.config.height = height;
    g_rtmp.config.fps = fps;
    g_rtmp.config.bitrate_kbps = bitrate_kbps;
    g_rtmp.config.keyframe_interval = keyframe_interval > 0 ? keyframe_interval : 2;
    g_rtmp.config.audio_sample_rate = audio_sample_rate > 0 ? audio_sample_rate : 44100;
    g_rtmp.config.audio_channels = audio_channels > 0 ? audio_channels : 2;
    g_rtmp.config.audio_bitrate_kbps = audio_bitrate_kbps > 0 ? audio_bitrate_kbps : 128;
    
    // Reset statistics
    g_rtmp.bytes_sent = 0;
    g_rtmp.frames_sent = 0;
    g_rtmp.dropped_frames = 0;
    
    // Allocate packet
    g_rtmp.packet = av_packet_alloc();
    if (!g_rtmp.packet) {
        SET_ERROR("Failed to allocate packet");
        MUTEX_UNLOCK(g_rtmp.mutex);
        return RTMP_ERROR_ALLOC_FAILED;
    }
    
    g_rtmp.state = RTMP_STATE_INITIALIZED;
    g_rtmp.error_msg[0] = '\0';
    
    MUTEX_UNLOCK(g_rtmp.mutex);
    return RTMP_SUCCESS;
}

RTMP_API int rtmp_connect(const char* url) {
    if (url == NULL || strlen(url) == 0) {
        SET_ERROR("URL is NULL or empty");
        return RTMP_ERROR_INVALID_PARAMS;
    }
    
    MUTEX_LOCK(g_rtmp.mutex);
    
    if (g_rtmp.state != RTMP_STATE_INITIALIZED) {
        SET_ERROR("Not initialized. Call rtmp_init first.");
        MUTEX_UNLOCK(g_rtmp.mutex);
        return RTMP_ERROR_NOT_CONNECTED;
    }
    
    int ret;
    
    // Create output format context for FLV/RTMP
    ret = avformat_alloc_output_context2(&g_rtmp.format_ctx, NULL, "flv", url);
    if (ret < 0 || !g_rtmp.format_ctx) {
        SET_ERROR("Failed to create output context: %s", av_err2str(ret));
        MUTEX_UNLOCK(g_rtmp.mutex);
        return RTMP_ERROR_INIT_FAILED;
    }
    
    // Initialize video encoder
    ret = init_video_encoder();
    if (ret != RTMP_SUCCESS) {
        avformat_free_context(g_rtmp.format_ctx);
        g_rtmp.format_ctx = NULL;
        MUTEX_UNLOCK(g_rtmp.mutex);
        return ret;
    }
    
    // Initialize audio encoder
    ret = init_audio_encoder();
    if (ret != RTMP_SUCCESS) {
        // Audio is optional, just log warning
        fprintf(stderr, "[RTMP] Warning: Audio encoder init failed, streaming video only\n");
    }
    
    // Open network connection
    if (!(g_rtmp.format_ctx->oformat->flags & AVFMT_NOFILE)) {
        ret = avio_open2(&g_rtmp.format_ctx->pb, url, AVIO_FLAG_WRITE, NULL, NULL);
        if (ret < 0) {
            SET_ERROR("Failed to open connection to %s: %s", url, av_err2str(ret));
            avcodec_free_context(&g_rtmp.video_codec_ctx);
            avformat_free_context(g_rtmp.format_ctx);
            g_rtmp.format_ctx = NULL;
            MUTEX_UNLOCK(g_rtmp.mutex);
            return RTMP_ERROR_CONNECT_FAILED;
        }
    }
    
    // Write stream header
    AVDictionary* opts = NULL;
    av_dict_set(&opts, "flvflags", "no_duration_filesize", 0);
    
    ret = avformat_write_header(g_rtmp.format_ctx, &opts);
    av_dict_free(&opts);
    
    if (ret < 0) {
        SET_ERROR("Failed to write header: %s", av_err2str(ret));
        avio_closep(&g_rtmp.format_ctx->pb);
        avcodec_free_context(&g_rtmp.video_codec_ctx);
        avformat_free_context(g_rtmp.format_ctx);
        g_rtmp.format_ctx = NULL;
        MUTEX_UNLOCK(g_rtmp.mutex);
        return RTMP_ERROR_CONNECT_FAILED;
    }
    
    g_rtmp.start_time = av_gettime_relative();
    g_rtmp.state = RTMP_STATE_CONNECTED;
    
    MUTEX_UNLOCK(g_rtmp.mutex);
    return RTMP_SUCCESS;
}

static int init_video_encoder(void) {
    // Find H.264 encoder
    const AVCodec* codec = avcodec_find_encoder(AV_CODEC_ID_H264);
    if (!codec) {
        SET_ERROR("H.264 encoder not found");
        return RTMP_ERROR_INIT_FAILED;
    }
    
    // Create video stream
    g_rtmp.video_stream = avformat_new_stream(g_rtmp.format_ctx, NULL);
    if (!g_rtmp.video_stream) {
        SET_ERROR("Failed to create video stream");
        return RTMP_ERROR_INIT_FAILED;
    }
    g_rtmp.video_stream->id = g_rtmp.format_ctx->nb_streams - 1;
    
    // Allocate codec context
    g_rtmp.video_codec_ctx = avcodec_alloc_context3(codec);
    if (!g_rtmp.video_codec_ctx) {
        SET_ERROR("Failed to allocate video codec context");
        return RTMP_ERROR_ALLOC_FAILED;
    }
    
    // Configure encoder
    AVCodecContext* c = g_rtmp.video_codec_ctx;
    c->codec_id = AV_CODEC_ID_H264;
    c->bit_rate = g_rtmp.config.bitrate_kbps * 1000;
    c->width = g_rtmp.config.width;
    c->height = g_rtmp.config.height;
    c->time_base = (AVRational){1, g_rtmp.config.fps};
    c->framerate = (AVRational){g_rtmp.config.fps, 1};
    c->gop_size = g_rtmp.config.fps * g_rtmp.config.keyframe_interval; // Keyframe every N seconds
    c->max_b_frames = 0; // No B-frames for low latency
    c->pix_fmt = AV_PIX_FMT_YUV420P;
    
    // Set encoder options for low latency streaming
    av_opt_set(c->priv_data, "preset", "veryfast", 0);
    av_opt_set(c->priv_data, "tune", "zerolatency", 0);
    av_opt_set(c->priv_data, "profile", "main", 0);
    
    // Global header flag for streaming
    if (g_rtmp.format_ctx->oformat->flags & AVFMT_GLOBALHEADER) {
        c->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
    }
    
    // Open encoder
    int ret = avcodec_open2(c, codec, NULL);
    if (ret < 0) {
        SET_ERROR("Failed to open video encoder: %s", av_err2str(ret));
        avcodec_free_context(&g_rtmp.video_codec_ctx);
        return RTMP_ERROR_INIT_FAILED;
    }
    
    // Copy codec params to stream
    ret = avcodec_parameters_from_context(g_rtmp.video_stream->codecpar, c);
    if (ret < 0) {
        SET_ERROR("Failed to copy codec params: %s", av_err2str(ret));
        avcodec_free_context(&g_rtmp.video_codec_ctx);
        return RTMP_ERROR_INIT_FAILED;
    }
    
    g_rtmp.video_stream->time_base = c->time_base;
    
    // Allocate video frame
    g_rtmp.video_frame = av_frame_alloc();
    if (!g_rtmp.video_frame) {
        SET_ERROR("Failed to allocate video frame");
        avcodec_free_context(&g_rtmp.video_codec_ctx);
        return RTMP_ERROR_ALLOC_FAILED;
    }
    
    g_rtmp.video_frame->format = c->pix_fmt;
    g_rtmp.video_frame->width = c->width;
    g_rtmp.video_frame->height = c->height;
    
    ret = av_frame_get_buffer(g_rtmp.video_frame, 0);
    if (ret < 0) {
        SET_ERROR("Failed to allocate video frame buffer: %s", av_err2str(ret));
        av_frame_free(&g_rtmp.video_frame);
        avcodec_free_context(&g_rtmp.video_codec_ctx);
        return RTMP_ERROR_ALLOC_FAILED;
    }
    
    // Create scaler for RGBA -> YUV420P conversion
    g_rtmp.sws_ctx = sws_getContext(
        g_rtmp.config.width, g_rtmp.config.height, AV_PIX_FMT_RGBA,
        c->width, c->height, AV_PIX_FMT_YUV420P,
        SWS_BILINEAR, NULL, NULL, NULL
    );
    
    if (!g_rtmp.sws_ctx) {
        SET_ERROR("Failed to create scaler context");
        av_frame_free(&g_rtmp.video_frame);
        avcodec_free_context(&g_rtmp.video_codec_ctx);
        return RTMP_ERROR_INIT_FAILED;
    }
    
    return RTMP_SUCCESS;
}

static int init_audio_encoder(void) {
    // Find AAC encoder
    const AVCodec* codec = avcodec_find_encoder(AV_CODEC_ID_AAC);
    if (!codec) {
        SET_ERROR("AAC encoder not found");
        return RTMP_ERROR_INIT_FAILED;
    }
    
    // Create audio stream
    g_rtmp.audio_stream = avformat_new_stream(g_rtmp.format_ctx, NULL);
    if (!g_rtmp.audio_stream) {
        SET_ERROR("Failed to create audio stream");
        return RTMP_ERROR_INIT_FAILED;
    }
    g_rtmp.audio_stream->id = g_rtmp.format_ctx->nb_streams - 1;
    
    // Allocate codec context
    g_rtmp.audio_codec_ctx = avcodec_alloc_context3(codec);
    if (!g_rtmp.audio_codec_ctx) {
        SET_ERROR("Failed to allocate audio codec context");
        return RTMP_ERROR_ALLOC_FAILED;
    }
    
    // Configure encoder
    AVCodecContext* c = g_rtmp.audio_codec_ctx;
    c->codec_id = AV_CODEC_ID_AAC;
    c->bit_rate = g_rtmp.config.audio_bitrate_kbps * 1000;
    c->sample_rate = g_rtmp.config.audio_sample_rate;
    
    // Set channel layout
    av_channel_layout_default(&c->ch_layout, g_rtmp.config.audio_channels);
    
    c->sample_fmt = AV_SAMPLE_FMT_FLTP; // AAC requires planar float
    c->time_base = (AVRational){1, c->sample_rate};
    
    if (g_rtmp.format_ctx->oformat->flags & AVFMT_GLOBALHEADER) {
        c->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
    }
    
    // Open encoder
    int ret = avcodec_open2(c, codec, NULL);
    if (ret < 0) {
        SET_ERROR("Failed to open audio encoder: %s", av_err2str(ret));
        avcodec_free_context(&g_rtmp.audio_codec_ctx);
        g_rtmp.audio_codec_ctx = NULL;
        return RTMP_ERROR_INIT_FAILED;
    }
    
    // Copy codec params to stream
    ret = avcodec_parameters_from_context(g_rtmp.audio_stream->codecpar, c);
    if (ret < 0) {
        SET_ERROR("Failed to copy audio codec params: %s", av_err2str(ret));
        avcodec_free_context(&g_rtmp.audio_codec_ctx);
        g_rtmp.audio_codec_ctx = NULL;
        return RTMP_ERROR_INIT_FAILED;
    }
    
    g_rtmp.audio_stream->time_base = c->time_base;
    
    // Allocate audio frame
    g_rtmp.audio_frame = av_frame_alloc();
    if (!g_rtmp.audio_frame) {
        SET_ERROR("Failed to allocate audio frame");
        avcodec_free_context(&g_rtmp.audio_codec_ctx);
        g_rtmp.audio_codec_ctx = NULL;
        return RTMP_ERROR_ALLOC_FAILED;
    }
    
    g_rtmp.audio_frame->format = c->sample_fmt;
    av_channel_layout_copy(&g_rtmp.audio_frame->ch_layout, &c->ch_layout);
    g_rtmp.audio_frame->sample_rate = c->sample_rate;
    g_rtmp.audio_frame->nb_samples = c->frame_size;
    
    ret = av_frame_get_buffer(g_rtmp.audio_frame, 0);
    if (ret < 0) {
        SET_ERROR("Failed to allocate audio frame buffer: %s", av_err2str(ret));
        av_frame_free(&g_rtmp.audio_frame);
        avcodec_free_context(&g_rtmp.audio_codec_ctx);
        g_rtmp.audio_codec_ctx = NULL;
        return RTMP_ERROR_ALLOC_FAILED;
    }
    
    // Create resampler for interleaved float -> planar float
    g_rtmp.swr_ctx = swr_alloc();
    if (!g_rtmp.swr_ctx) {
        SET_ERROR("Failed to allocate resampler");
        av_frame_free(&g_rtmp.audio_frame);
        avcodec_free_context(&g_rtmp.audio_codec_ctx);
        g_rtmp.audio_codec_ctx = NULL;
        return RTMP_ERROR_ALLOC_FAILED;
    }
    
    AVChannelLayout in_layout;
    av_channel_layout_default(&in_layout, g_rtmp.config.audio_channels);
    
    av_opt_set_chlayout(g_rtmp.swr_ctx, "in_chlayout", &in_layout, 0);
    av_opt_set_chlayout(g_rtmp.swr_ctx, "out_chlayout", &c->ch_layout, 0);
    av_opt_set_int(g_rtmp.swr_ctx, "in_sample_rate", g_rtmp.config.audio_sample_rate, 0);
    av_opt_set_int(g_rtmp.swr_ctx, "out_sample_rate", c->sample_rate, 0);
    av_opt_set_sample_fmt(g_rtmp.swr_ctx, "in_sample_fmt", AV_SAMPLE_FMT_FLT, 0); // Unity uses float
    av_opt_set_sample_fmt(g_rtmp.swr_ctx, "out_sample_fmt", AV_SAMPLE_FMT_FLTP, 0);
    
    ret = swr_init(g_rtmp.swr_ctx);
    if (ret < 0) {
        SET_ERROR("Failed to init resampler: %s", av_err2str(ret));
        swr_free(&g_rtmp.swr_ctx);
        av_frame_free(&g_rtmp.audio_frame);
        avcodec_free_context(&g_rtmp.audio_codec_ctx);
        g_rtmp.audio_codec_ctx = NULL;
        return RTMP_ERROR_INIT_FAILED;
    }
    
    av_channel_layout_uninit(&in_layout);
    
    return RTMP_SUCCESS;
}

RTMP_API int rtmp_start_streaming(void) {
    MUTEX_LOCK(g_rtmp.mutex);
    
    if (g_rtmp.state != RTMP_STATE_CONNECTED) {
        SET_ERROR("Not connected. Call rtmp_connect first.");
        MUTEX_UNLOCK(g_rtmp.mutex);
        return RTMP_ERROR_NOT_CONNECTED;
    }
    
    g_rtmp.state = RTMP_STATE_STREAMING;
    g_rtmp.start_time = av_gettime_relative();
    
    MUTEX_UNLOCK(g_rtmp.mutex);
    return RTMP_SUCCESS;
}

RTMP_API int rtmp_send_video_frame(const uint8_t* rgba_data, int data_size, int64_t pts) {
    if (rgba_data == NULL) {
        SET_ERROR("RGBA data is NULL");
        return RTMP_ERROR_INVALID_PARAMS;
    }
    
    int expected_size = g_rtmp.config.width * g_rtmp.config.height * 4;
    if (data_size != expected_size) {
        SET_ERROR("Invalid data size: expected %d, got %d", expected_size, data_size);
        return RTMP_ERROR_INVALID_PARAMS;
    }
    
    MUTEX_LOCK(g_rtmp.mutex);
    
    if (g_rtmp.state != RTMP_STATE_STREAMING) {
        SET_ERROR("Not streaming");
        MUTEX_UNLOCK(g_rtmp.mutex);
        return RTMP_ERROR_NOT_CONNECTED;
    }
    
    int ret = encode_and_send_video(rgba_data, pts);
    
    MUTEX_UNLOCK(g_rtmp.mutex);
    return ret;
}

static int encode_and_send_video(const uint8_t* rgba_data, int64_t pts) {
    int ret;
    
    // Make frame writable
    ret = av_frame_make_writable(g_rtmp.video_frame);
    if (ret < 0) {
        SET_ERROR("Failed to make frame writable: %s", av_err2str(ret));
        return RTMP_ERROR_ENCODE_FAILED;
    }
    
    // Convert RGBA to YUV420P
    const uint8_t* src_data[1] = { rgba_data };
    int src_linesize[1] = { g_rtmp.config.width * 4 };
    
    sws_scale(
        g_rtmp.sws_ctx,
        src_data, src_linesize, 0, g_rtmp.config.height,
        g_rtmp.video_frame->data, g_rtmp.video_frame->linesize
    );
    
    // Set PTS
    g_rtmp.video_frame->pts = av_rescale_q(
        pts,
        (AVRational){1, 1000}, // Input is in milliseconds
        g_rtmp.video_codec_ctx->time_base
    );
    
    // Send frame to encoder
    ret = avcodec_send_frame(g_rtmp.video_codec_ctx, g_rtmp.video_frame);
    if (ret < 0) {
        SET_ERROR("Failed to send frame to encoder: %s", av_err2str(ret));
        return RTMP_ERROR_ENCODE_FAILED;
    }
    
    // Receive and write encoded packets
    while (ret >= 0) {
        ret = avcodec_receive_packet(g_rtmp.video_codec_ctx, g_rtmp.packet);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        } else if (ret < 0) {
            SET_ERROR("Error receiving packet: %s", av_err2str(ret));
            return RTMP_ERROR_ENCODE_FAILED;
        }
        
        // Rescale timestamps
        av_packet_rescale_ts(g_rtmp.packet, g_rtmp.video_codec_ctx->time_base, g_rtmp.video_stream->time_base);
        g_rtmp.packet->stream_index = g_rtmp.video_stream->index;
        
        // Write packet
        ret = av_interleaved_write_frame(g_rtmp.format_ctx, g_rtmp.packet);
        if (ret < 0) {
            SET_ERROR("Failed to write video packet: %s", av_err2str(ret));
            av_packet_unref(g_rtmp.packet);
            g_rtmp.dropped_frames++;
            return RTMP_ERROR_SEND_FAILED;
        }
        
        g_rtmp.bytes_sent += g_rtmp.packet->size;
        av_packet_unref(g_rtmp.packet);
    }
    
    g_rtmp.frames_sent++;
    return RTMP_SUCCESS;
}

RTMP_API int rtmp_send_audio(const float* pcm_data, int num_samples, int64_t pts) {
    if (pcm_data == NULL || num_samples <= 0) {
        return RTMP_ERROR_INVALID_PARAMS;
    }
    
    MUTEX_LOCK(g_rtmp.mutex);
    
    if (g_rtmp.state != RTMP_STATE_STREAMING || !g_rtmp.audio_codec_ctx) {
        MUTEX_UNLOCK(g_rtmp.mutex);
        return RTMP_SUCCESS; // Audio is optional
    }
    
    int ret = encode_and_send_audio(pcm_data, num_samples, pts);
    
    MUTEX_UNLOCK(g_rtmp.mutex);
    return ret;
}

static int encode_and_send_audio(const float* pcm_data, int num_samples, int64_t pts) {
    int ret;
    
    // Make frame writable
    ret = av_frame_make_writable(g_rtmp.audio_frame);
    if (ret < 0) {
        return RTMP_ERROR_ENCODE_FAILED;
    }
    
    // Resample audio
    const uint8_t* in_data[1] = { (const uint8_t*)pcm_data };
    
    ret = swr_convert(
        g_rtmp.swr_ctx,
        g_rtmp.audio_frame->data,
        g_rtmp.audio_frame->nb_samples,
        in_data,
        num_samples
    );
    
    if (ret < 0) {
        return RTMP_ERROR_ENCODE_FAILED;
    }
    
    // Set PTS
    g_rtmp.audio_frame->pts = av_rescale_q(
        pts,
        (AVRational){1, 1000},
        g_rtmp.audio_codec_ctx->time_base
    );
    
    // Send frame to encoder
    ret = avcodec_send_frame(g_rtmp.audio_codec_ctx, g_rtmp.audio_frame);
    if (ret < 0) {
        return RTMP_ERROR_ENCODE_FAILED;
    }
    
    // Receive and write packets
    while (ret >= 0) {
        ret = avcodec_receive_packet(g_rtmp.audio_codec_ctx, g_rtmp.packet);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        } else if (ret < 0) {
            return RTMP_ERROR_ENCODE_FAILED;
        }
        
        av_packet_rescale_ts(g_rtmp.packet, g_rtmp.audio_codec_ctx->time_base, g_rtmp.audio_stream->time_base);
        g_rtmp.packet->stream_index = g_rtmp.audio_stream->index;
        
        ret = av_interleaved_write_frame(g_rtmp.format_ctx, g_rtmp.packet);
        if (ret < 0) {
            av_packet_unref(g_rtmp.packet);
            return RTMP_ERROR_SEND_FAILED;
        }
        
        g_rtmp.bytes_sent += g_rtmp.packet->size;
        av_packet_unref(g_rtmp.packet);
    }
    
    return RTMP_SUCCESS;
}

RTMP_API int rtmp_stop_streaming(void) {
    MUTEX_LOCK(g_rtmp.mutex);
    
    if (g_rtmp.state == RTMP_STATE_STREAMING) {
        g_rtmp.state = RTMP_STATE_CONNECTED;
    }
    
    MUTEX_UNLOCK(g_rtmp.mutex);
    return RTMP_SUCCESS;
}

RTMP_API int rtmp_disconnect(void) {
    MUTEX_LOCK(g_rtmp.mutex);
    
    if (g_rtmp.format_ctx) {
        // Flush encoders
        if (g_rtmp.video_codec_ctx) {
            avcodec_send_frame(g_rtmp.video_codec_ctx, NULL);
            while (avcodec_receive_packet(g_rtmp.video_codec_ctx, g_rtmp.packet) >= 0) {
                av_packet_rescale_ts(g_rtmp.packet, g_rtmp.video_codec_ctx->time_base, g_rtmp.video_stream->time_base);
                g_rtmp.packet->stream_index = g_rtmp.video_stream->index;
                av_interleaved_write_frame(g_rtmp.format_ctx, g_rtmp.packet);
                av_packet_unref(g_rtmp.packet);
            }
        }
        
        // Write trailer
        av_write_trailer(g_rtmp.format_ctx);
        
        // Close connection
        if (!(g_rtmp.format_ctx->oformat->flags & AVFMT_NOFILE)) {
            avio_closep(&g_rtmp.format_ctx->pb);
        }
    }
    
    // Clean up resources
    if (g_rtmp.sws_ctx) {
        sws_freeContext(g_rtmp.sws_ctx);
        g_rtmp.sws_ctx = NULL;
    }
    
    if (g_rtmp.swr_ctx) {
        swr_free(&g_rtmp.swr_ctx);
    }
    
    if (g_rtmp.video_frame) {
        av_frame_free(&g_rtmp.video_frame);
    }
    
    if (g_rtmp.audio_frame) {
        av_frame_free(&g_rtmp.audio_frame);
    }
    
    if (g_rtmp.video_codec_ctx) {
        avcodec_free_context(&g_rtmp.video_codec_ctx);
    }
    
    if (g_rtmp.audio_codec_ctx) {
        avcodec_free_context(&g_rtmp.audio_codec_ctx);
    }
    
    if (g_rtmp.format_ctx) {
        avformat_free_context(g_rtmp.format_ctx);
        g_rtmp.format_ctx = NULL;
    }
    
    g_rtmp.video_stream = NULL;
    g_rtmp.audio_stream = NULL;
    g_rtmp.state = RTMP_STATE_INITIALIZED;
    
    MUTEX_UNLOCK(g_rtmp.mutex);
    return RTMP_SUCCESS;
}

RTMP_API void rtmp_cleanup(void) {
    rtmp_disconnect();
    
    MUTEX_LOCK(g_rtmp.mutex);
    
    if (g_rtmp.packet) {
        av_packet_free(&g_rtmp.packet);
    }
    
    g_rtmp.state = RTMP_STATE_IDLE;
    
    MUTEX_UNLOCK(g_rtmp.mutex);
}

RTMP_API int rtmp_get_state(void) {
    return g_rtmp.state;
}

RTMP_API const char* rtmp_get_error(void) {
    return g_rtmp.error_msg;
}

RTMP_API int64_t rtmp_get_bytes_sent(void) {
    return g_rtmp.bytes_sent;
}

RTMP_API int rtmp_get_frames_sent(void) {
    return g_rtmp.frames_sent;
}

RTMP_API int rtmp_get_dropped_frames(void) {
    return g_rtmp.dropped_frames;
}

RTMP_API int rtmp_is_stub(void) {
    return 0;
}

RTMP_API const char* rtmp_get_build_info(void) {
    return "ffmpeg-bridge";
}
