using System;
using System.Runtime.InteropServices;

namespace Substream.Streaming
{
    /// <summary>
    /// P/Invoke wrapper for the native FFmpeg RTMP bridge library.
    /// Provides low-level access to RTMPS streaming functionality.
    /// </summary>
    public static class NativeFFmpegBridge
    {
        // Library name (without extension - Unity handles platform differences)
        private const string LIBRARY_NAME = "ffmpeg_rtmp";

        // ==========================================
        // ERROR CODES
        // ==========================================

        public const int RTMP_SUCCESS = 0;
        public const int RTMP_ERROR_INIT_FAILED = -1;
        public const int RTMP_ERROR_CONNECT_FAILED = -2;
        public const int RTMP_ERROR_ENCODE_FAILED = -3;
        public const int RTMP_ERROR_SEND_FAILED = -4;
        public const int RTMP_ERROR_NOT_CONNECTED = -5;
        public const int RTMP_ERROR_INVALID_PARAMS = -6;
        public const int RTMP_ERROR_ALLOC_FAILED = -7;

        // ==========================================
        // STATE ENUM
        // ==========================================

        public enum RTMPState
        {
            Idle = 0,
            Initialized = 1,
            Connected = 2,
            Streaming = 3,
            Error = -1
        }

        // ==========================================
        // CONFIGURATION STRUCTURE
        // ==========================================

        [StructLayout(LayoutKind.Sequential)]
        public struct RTMPConfig
        {
            public int width;
            public int height;
            public int fps;
            public int bitrate_kbps;
            public int keyframe_interval;
            public int audio_sample_rate;
            public int audio_channels;
            public int audio_bitrate_kbps;

            public static RTMPConfig Default => new RTMPConfig
            {
                width = 1280,
                height = 720,
                fps = 30,
                bitrate_kbps = 3500,
                keyframe_interval = 2,
                audio_sample_rate = 44100,
                audio_channels = 2,
                audio_bitrate_kbps = 128
            };
        }

        // ==========================================
        // NATIVE FUNCTION IMPORTS
        // ==========================================

        /// <summary>
        /// Initialize the RTMP encoder with configuration structure.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_init(ref RTMPConfig config);

        /// <summary>
        /// Initialize with individual parameters (simpler to call from C#).
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_init_simple(
            int width,
            int height,
            int fps,
            int bitrate_kbps,
            int keyframe_interval,
            int audio_sample_rate,
            int audio_channels,
            int audio_bitrate_kbps
        );

        /// <summary>
        /// Connect to an RTMP/RTMPS server.
        /// </summary>
        /// <param name="url">Full RTMP URL including stream key</param>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Ansi)]
        public static extern int rtmp_connect([MarshalAs(UnmanagedType.LPStr)] string url);

        /// <summary>
        /// Start streaming (call after connect).
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_start_streaming();

        /// <summary>
        /// Send a video frame.
        /// </summary>
        /// <param name="rgba_data">Pointer to RGBA pixel data</param>
        /// <param name="data_size">Size in bytes (width * height * 4)</param>
        /// <param name="pts">Presentation timestamp in milliseconds</param>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_send_video_frame(IntPtr rgba_data, int data_size, long pts);

        /// <summary>
        /// Send a video frame from byte array.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_send_video_frame(
            [MarshalAs(UnmanagedType.LPArray)] byte[] rgba_data, 
            int data_size, 
            long pts
        );

        /// <summary>
        /// Send audio samples.
        /// </summary>
        /// <param name="pcm_data">Pointer to float PCM samples (interleaved)</param>
        /// <param name="num_samples">Number of samples per channel</param>
        /// <param name="pts">Presentation timestamp in milliseconds</param>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_send_audio(IntPtr pcm_data, int num_samples, long pts);

        /// <summary>
        /// Send audio from float array.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_send_audio(
            [MarshalAs(UnmanagedType.LPArray)] float[] pcm_data, 
            int num_samples, 
            long pts
        );

        /// <summary>
        /// Stop streaming but keep connection.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_stop_streaming();

        /// <summary>
        /// Disconnect from server and clean up.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_disconnect();

        /// <summary>
        /// Clean up all resources.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void rtmp_cleanup();

        /// <summary>
        /// Get current state.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_get_state();

        /// <summary>
        /// Get last error message.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        private static extern IntPtr rtmp_get_error();

        /// <summary>
        /// Get last error as string.
        /// </summary>
        public static string GetError()
        {
            IntPtr ptr = rtmp_get_error();
            if (ptr == IntPtr.Zero) return string.Empty;
            return Marshal.PtrToStringAnsi(ptr) ?? string.Empty;
        }

        /// <summary>
        /// Get bytes sent.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern long rtmp_get_bytes_sent();

        /// <summary>
        /// Get frames sent.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_get_frames_sent();

        /// <summary>
        /// Get dropped frames.
        /// </summary>
        [DllImport(LIBRARY_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int rtmp_get_dropped_frames();

        // ==========================================
        // HELPER METHODS
        // ==========================================

        /// <summary>
        /// Check if native library is available.
        /// </summary>
        public static bool IsAvailable()
        {
            try
            {
                rtmp_get_state();
                return true;
            }
            catch (DllNotFoundException)
            {
                return false;
            }
            catch (EntryPointNotFoundException)
            {
                return false;
            }
        }

        /// <summary>
        /// Get state as enum.
        /// </summary>
        public static RTMPState GetState()
        {
            int state = rtmp_get_state();
            return (RTMPState)state;
        }

        /// <summary>
        /// Check result and throw if error.
        /// </summary>
        public static void CheckResult(int result, string operation = "RTMP operation")
        {
            if (result != RTMP_SUCCESS)
            {
                string error = GetError();
                throw new RTMPException(result, $"{operation} failed: {error}");
            }
        }
    }

    /// <summary>
    /// Exception thrown by RTMP operations.
    /// </summary>
    public class RTMPException : Exception
    {
        public int ErrorCode { get; }

        public RTMPException(int errorCode, string message) : base(message)
        {
            ErrorCode = errorCode;
        }
    }
}

