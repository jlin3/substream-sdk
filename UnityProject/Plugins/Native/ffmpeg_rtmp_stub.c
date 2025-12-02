/**
 * FFmpeg RTMP Bridge - Stub Implementation
 * 
 * This is a stub implementation for platforms where FFmpeg isn't available yet.
 * It allows the Unity project to build and run, but streaming won't work.
 * 
 * To enable real streaming, replace this with ffmpeg_rtmp_bridge.c compiled
 * with FFmpeg libraries for your target platform.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

// State
static int g_state = 0;  // 0 = idle, 1 = init, 2 = connected, -1 = error
static char g_error[256] = "";
static int g_frames_sent = 0;
static int g_dropped_frames = 0;
static long g_bytes_sent = 0;

// Error codes
#define RTMP_SUCCESS 0
#define RTMP_ERROR_NOT_IMPLEMENTED -100

static void set_error(const char* msg) {
    strncpy(g_error, msg, sizeof(g_error) - 1);
    g_error[sizeof(g_error) - 1] = '\0';
}

// ==========================================
// PUBLIC API (Stub Implementation)
// ==========================================

int rtmp_init_simple(int width, int height, int fps, int bitrate_kbps,
                     int keyframe_interval, int audio_sample_rate,
                     int audio_channels, int audio_bitrate_kbps) {
    printf("[RTMP STUB] init: %dx%d @ %dfps, %dkbps\n", width, height, fps, bitrate_kbps);
    set_error("Stub implementation - FFmpeg not available on this platform");
    g_state = 1;
    return RTMP_SUCCESS;
}

int rtmp_connect(const char* url) {
    printf("[RTMP STUB] connect: %.50s...\n", url);
    printf("[RTMP STUB] WARNING: This is a stub! Real streaming requires FFmpeg.\n");
    g_state = 2;
    return RTMP_SUCCESS;
}

int rtmp_start_streaming(void) {
    printf("[RTMP STUB] start_streaming\n");
    return RTMP_SUCCESS;
}

int rtmp_send_video_frame(void* rgba_data, int data_size, long pts) {
    // Simulate sending without actually doing anything
    g_frames_sent++;
    g_bytes_sent += data_size;
    
    // Log occasionally
    if (g_frames_sent % 300 == 0) {
        printf("[RTMP STUB] Simulated %d frames (%.2f MB)\n", 
               g_frames_sent, g_bytes_sent / 1048576.0);
    }
    
    return RTMP_SUCCESS;
}

int rtmp_send_audio(void* pcm_data, int num_samples, long pts) {
    // Stub - do nothing
    return RTMP_SUCCESS;
}

int rtmp_stop_streaming(void) {
    printf("[RTMP STUB] stop_streaming\n");
    return RTMP_SUCCESS;
}

int rtmp_disconnect(void) {
    printf("[RTMP STUB] disconnect\n");
    g_state = 0;
    return RTMP_SUCCESS;
}

void rtmp_cleanup(void) {
    printf("[RTMP STUB] cleanup - sent %d frames total\n", g_frames_sent);
    g_state = 0;
    g_frames_sent = 0;
    g_bytes_sent = 0;
}

int rtmp_get_state(void) {
    return g_state;
}

const char* rtmp_get_error(void) {
    return g_error;
}

long rtmp_get_bytes_sent(void) {
    return g_bytes_sent;
}

int rtmp_get_frames_sent(void) {
    return g_frames_sent;
}

int rtmp_get_dropped_frames(void) {
    return g_dropped_frames;
}

