/**
 * FFmpeg RTMP Bridge - Native Library for Unity
 * 
 * Cross-platform RTMPS streaming using FFmpeg libraries.
 * Supports Windows, Android (Quest), and iOS.
 */

#ifndef FFMPEG_RTMP_BRIDGE_H
#define FFMPEG_RTMP_BRIDGE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Platform-specific export macros
#if defined(_WIN32) || defined(_WIN64)
    #define RTMP_API __declspec(dllexport)
#elif defined(__ANDROID__) || defined(__APPLE__)
    #define RTMP_API __attribute__((visibility("default")))
#else
    #define RTMP_API
#endif

// Error codes
#define RTMP_SUCCESS 0
#define RTMP_ERROR_INIT_FAILED -1
#define RTMP_ERROR_CONNECT_FAILED -2
#define RTMP_ERROR_ENCODE_FAILED -3
#define RTMP_ERROR_SEND_FAILED -4
#define RTMP_ERROR_NOT_CONNECTED -5
#define RTMP_ERROR_INVALID_PARAMS -6
#define RTMP_ERROR_ALLOC_FAILED -7

// Stream state
typedef enum {
    RTMP_STATE_IDLE = 0,
    RTMP_STATE_INITIALIZED = 1,
    RTMP_STATE_CONNECTED = 2,
    RTMP_STATE_STREAMING = 3,
    RTMP_STATE_ERROR = -1
} RTMPState;

// Configuration structure
typedef struct {
    int width;
    int height;
    int fps;
    int bitrate_kbps;
    int keyframe_interval;  // in seconds
    int audio_sample_rate;
    int audio_channels;
    int audio_bitrate_kbps;
} RTMPConfig;

/**
 * Initialize the RTMP encoder with the given configuration.
 * Must be called before connect().
 * 
 * @param config Pointer to configuration structure
 * @return RTMP_SUCCESS or error code
 */
RTMP_API int rtmp_init(const RTMPConfig* config);

/**
 * Simplified init with individual parameters (for easier P/Invoke)
 */
RTMP_API int rtmp_init_simple(
    int width, 
    int height, 
    int fps, 
    int bitrate_kbps,
    int keyframe_interval,
    int audio_sample_rate,
    int audio_channels,
    int audio_bitrate_kbps
);

/**
 * Connect to an RTMP/RTMPS server.
 * 
 * @param url Full RTMP URL including stream key
 * @return RTMP_SUCCESS or error code
 */
RTMP_API int rtmp_connect(const char* url);

/**
 * Send a video frame.
 * 
 * @param rgba_data Pointer to RGBA pixel data (width * height * 4 bytes)
 * @param data_size Size of the data in bytes
 * @param pts Presentation timestamp in milliseconds
 * @return RTMP_SUCCESS or error code
 */
RTMP_API int rtmp_send_video_frame(const uint8_t* rgba_data, int data_size, int64_t pts);

/**
 * Send audio samples.
 * 
 * @param pcm_data Pointer to PCM audio data (float samples, interleaved)
 * @param num_samples Number of samples per channel
 * @param pts Presentation timestamp in milliseconds
 * @return RTMP_SUCCESS or error code
 */
RTMP_API int rtmp_send_audio(const float* pcm_data, int num_samples, int64_t pts);

/**
 * Start streaming (call after connect, before sending frames)
 * 
 * @return RTMP_SUCCESS or error code
 */
RTMP_API int rtmp_start_streaming(void);

/**
 * Stop streaming but keep connection open
 * 
 * @return RTMP_SUCCESS or error code
 */
RTMP_API int rtmp_stop_streaming(void);

/**
 * Disconnect from the server and clean up resources.
 * 
 * @return RTMP_SUCCESS or error code
 */
RTMP_API int rtmp_disconnect(void);

/**
 * Clean up all resources.
 * Should be called when done with the library.
 */
RTMP_API void rtmp_cleanup(void);

/**
 * Get current state.
 * 
 * @return Current RTMPState
 */
RTMP_API int rtmp_get_state(void);

/**
 * Get last error message.
 * 
 * @return Pointer to error string (valid until next call)
 */
RTMP_API const char* rtmp_get_error(void);

/**
 * Get statistics.
 */
RTMP_API int64_t rtmp_get_bytes_sent(void);
RTMP_API int rtmp_get_frames_sent(void);
RTMP_API int rtmp_get_dropped_frames(void);

/**
 * Identify whether this build is the stub implementation.
 * Returns 1 for stub, 0 for real implementation.
 */
RTMP_API int rtmp_is_stub(void);

/**
 * Optional build info string (e.g. "stub" or "ffmpeg-bridge").
 * May return NULL or empty if not available.
 */
RTMP_API const char* rtmp_get_build_info(void);

#ifdef __cplusplus
}
#endif

#endif // FFMPEG_RTMP_BRIDGE_H

