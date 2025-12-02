cmake_minimum_required(VERSION 3.16)
project(ffmpeg_rtmp VERSION 1.0.0 LANGUAGES C)

# Set C standard
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Platform detection
if(WIN32)
    set(PLATFORM_NAME "windows")
    set(LIB_PREFIX "")
    set(LIB_SUFFIX ".dll")
elseif(ANDROID)
    set(PLATFORM_NAME "android")
    set(LIB_PREFIX "lib")
    set(LIB_SUFFIX ".so")
elseif(APPLE)
    if(IOS)
        set(PLATFORM_NAME "ios")
    else()
        set(PLATFORM_NAME "macos")
    endif()
    set(LIB_PREFIX "lib")
    set(LIB_SUFFIX ".dylib")
else()
    set(PLATFORM_NAME "linux")
    set(LIB_PREFIX "lib")
    set(LIB_SUFFIX ".so")
endif()

message(STATUS "Building for platform: ${PLATFORM_NAME}")

# FFmpeg paths (set by build script or environment)
set(FFMPEG_ROOT "" CACHE PATH "Path to FFmpeg installation")

if(NOT FFMPEG_ROOT)
    # Try to find FFmpeg in common locations
    if(WIN32)
        set(FFMPEG_ROOT "C:/ffmpeg" CACHE PATH "FFmpeg root" FORCE)
    elseif(APPLE)
        set(FFMPEG_ROOT "/opt/homebrew" CACHE PATH "FFmpeg root" FORCE)
    else()
        set(FFMPEG_ROOT "/usr" CACHE PATH "FFmpeg root" FORCE)
    endif()
endif()

message(STATUS "FFmpeg root: ${FFMPEG_ROOT}")

# Find FFmpeg libraries
find_path(AVCODEC_INCLUDE_DIR libavcodec/avcodec.h
    HINTS ${FFMPEG_ROOT}/include
    PATHS /opt/homebrew/include /usr/include /usr/local/include
)

find_path(AVFORMAT_INCLUDE_DIR libavformat/avformat.h
    HINTS ${FFMPEG_ROOT}/include
    PATHS /opt/homebrew/include /usr/include /usr/local/include
)

find_path(AVUTIL_INCLUDE_DIR libavutil/avutil.h
    HINTS ${FFMPEG_ROOT}/include
    PATHS /opt/homebrew/include /usr/include /usr/local/include
)

find_path(SWSCALE_INCLUDE_DIR libswscale/swscale.h
    HINTS ${FFMPEG_ROOT}/include
    PATHS /opt/homebrew/include /usr/include /usr/local/include
)

find_path(SWRESAMPLE_INCLUDE_DIR libswresample/swresample.h
    HINTS ${FFMPEG_ROOT}/include
    PATHS /opt/homebrew/include /usr/include /usr/local/include
)

# Find libraries
find_library(AVCODEC_LIBRARY avcodec
    HINTS ${FFMPEG_ROOT}/lib ${FFMPEG_ROOT}/bin
    PATHS /opt/homebrew/lib /usr/lib /usr/local/lib
)

find_library(AVFORMAT_LIBRARY avformat
    HINTS ${FFMPEG_ROOT}/lib ${FFMPEG_ROOT}/bin
    PATHS /opt/homebrew/lib /usr/lib /usr/local/lib
)

find_library(AVUTIL_LIBRARY avutil
    HINTS ${FFMPEG_ROOT}/lib ${FFMPEG_ROOT}/bin
    PATHS /opt/homebrew/lib /usr/lib /usr/local/lib
)

find_library(SWSCALE_LIBRARY swscale
    HINTS ${FFMPEG_ROOT}/lib ${FFMPEG_ROOT}/bin
    PATHS /opt/homebrew/lib /usr/lib /usr/local/lib
)

find_library(SWRESAMPLE_LIBRARY swresample
    HINTS ${FFMPEG_ROOT}/lib ${FFMPEG_ROOT}/bin
    PATHS /opt/homebrew/lib /usr/lib /usr/local/lib
)

# Check if all components found
if(NOT AVCODEC_INCLUDE_DIR OR NOT AVFORMAT_INCLUDE_DIR OR NOT AVUTIL_INCLUDE_DIR)
    message(FATAL_ERROR "FFmpeg headers not found. Set FFMPEG_ROOT to FFmpeg installation path.")
endif()

if(NOT AVCODEC_LIBRARY OR NOT AVFORMAT_LIBRARY OR NOT AVUTIL_LIBRARY)
    message(FATAL_ERROR "FFmpeg libraries not found. Set FFMPEG_ROOT to FFmpeg installation path.")
endif()

message(STATUS "FFmpeg includes: ${AVCODEC_INCLUDE_DIR}")
message(STATUS "FFmpeg libavcodec: ${AVCODEC_LIBRARY}")

# Create shared library
add_library(ffmpeg_rtmp SHARED
    ffmpeg_rtmp_bridge.c
    ffmpeg_rtmp_bridge.h
)

# Include directories
target_include_directories(ffmpeg_rtmp PRIVATE
    ${AVCODEC_INCLUDE_DIR}
    ${AVFORMAT_INCLUDE_DIR}
    ${AVUTIL_INCLUDE_DIR}
    ${SWSCALE_INCLUDE_DIR}
    ${SWRESAMPLE_INCLUDE_DIR}
)

# Link libraries
target_link_libraries(ffmpeg_rtmp PRIVATE
    ${AVCODEC_LIBRARY}
    ${AVFORMAT_LIBRARY}
    ${AVUTIL_LIBRARY}
    ${SWSCALE_LIBRARY}
    ${SWRESAMPLE_LIBRARY}
)

# Platform-specific settings
if(WIN32)
    target_compile_definitions(ffmpeg_rtmp PRIVATE _CRT_SECURE_NO_WARNINGS)
    # Link Windows libraries
    target_link_libraries(ffmpeg_rtmp PRIVATE ws2_32 secur32 bcrypt)
elseif(ANDROID)
    target_link_libraries(ffmpeg_rtmp PRIVATE log android)
elseif(APPLE)
    target_link_libraries(ffmpeg_rtmp PRIVATE
        "-framework CoreFoundation"
        "-framework CoreMedia"
        "-framework CoreVideo"
        "-framework VideoToolbox"
        "-framework AudioToolbox"
    )
    if(IOS)
        set_target_properties(ffmpeg_rtmp PROPERTIES
            XCODE_ATTRIBUTE_IPHONEOS_DEPLOYMENT_TARGET "12.0"
        )
    endif()
endif()

# Set output directory
set_target_properties(ffmpeg_rtmp PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/out"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/out"
)

# Install rules
install(TARGETS ffmpeg_rtmp
    LIBRARY DESTINATION lib
    RUNTIME DESTINATION bin
)

