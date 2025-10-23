/**
 * StreamRecorder - Browser-side recording for VR streams
 * Uses MediaRecorder API to record and upload chunks to backend
 */
class StreamRecorder {
  constructor(stream, sessionId, backendUrl = '', authToken = '') {
    this.stream = stream;
    this.sessionId = sessionId;
    this.backendUrl = backendUrl || window.location.origin;
    this.authToken = authToken;
    this.chunks = [];
    this.isRecording = false;
    this.uploadedChunks = 0;
    
    // Try to use the best codec available (VP9 is best quality)
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',  // Best quality
      'video/webm;codecs=vp8,opus',  // Good fallback
      'video/webm;codecs=h264,opus', // Compatibility
      'video/webm'
    ];
    
    this.mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
    console.log('🎥 Recording codec:', this.mimeType);
    
    // Initialize MediaRecorder with HIGH QUALITY settings
    try {
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.mimeType,
        videoBitsPerSecond: 10000000, // 10 Mbps for excellent quality
        audioBitsPerSecond: 256000    // 256 kbps for high-fidelity audio
      });
      
      console.log('✅ High-quality recording initialized:');
      console.log('   Video: 10 Mbps');
      console.log('   Audio: 256 kbps');
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
          console.log(`Recorded chunk ${this.chunks.length}: ${(e.data.size / 1024).toFixed(2)}KB`);
          
          // Auto-upload chunks every 10 seconds to prevent memory issues
          if (this.chunks.length >= 10) {
            this.uploadChunks();
          }
        }
      };
      
      this.mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
      };
      
      this.mediaRecorder.onstop = () => {
        console.log('Recording stopped');
        if (this.chunks.length > 0) {
          this.uploadChunks();
        }
      };
    } catch (error) {
      console.error('Failed to create MediaRecorder:', error);
      throw error;
    }
  }
  
  /**
   * Start recording
   */
  start() {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }
    
    this.chunks = [];
    this.uploadedChunks = 0;
    this.isRecording = true;
    
    // Collect data every 10 seconds for better quality
    // Longer chunks = better compression efficiency = higher quality
    this.mediaRecorder.start(10000);
    console.log('✅ HIGH QUALITY Recording started');
    console.log('   Video: 10 Mbps, Audio: 256 kbps');
    console.log('   Chunk interval: 10 seconds');
  }
  
  /**
   * Stop recording
   */
  async stop() {
    if (!this.isRecording) {
      console.warn('Not recording');
      return null;
    }
    
    return new Promise((resolve, reject) => {
      this.mediaRecorder.onstop = async () => {
        console.log('Recording stopped, uploading final chunks...');
        
        try {
          if (this.chunks.length > 0) {
            await this.uploadChunks();
          }
          this.isRecording = false;
          console.log(`✅ Recording complete. Uploaded ${this.uploadedChunks} chunks total.`);
          resolve({
            chunks: this.uploadedChunks,
            sessionId: this.sessionId
          });
        } catch (error) {
          reject(error);
        }
      };
      
      this.mediaRecorder.stop();
    });
  }
  
  /**
   * Upload accumulated chunks to backend
   */
  async uploadChunks() {
    if (this.chunks.length === 0) {
      return;
    }
    
    const chunksToUpload = [...this.chunks];
    this.chunks = []; // Clear chunks array
    
    const blob = new Blob(chunksToUpload, { type: this.mimeType });
    const chunkNumber = this.uploadedChunks++;
    
    console.log(`Uploading chunk ${chunkNumber}: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
    
    const formData = new FormData();
    formData.append('recording', blob, `chunk-${chunkNumber}-${Date.now()}.webm`);
    formData.append('sessionId', this.sessionId);
    formData.append('chunkNumber', chunkNumber.toString());
    
    try {
      const headers = {
        'Accept': 'application/json'
      };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      const response = await fetch(`${this.backendUrl}/api/recordings/upload`, {
        method: 'POST',
        headers: headers,
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Chunk ${chunkNumber} uploaded:`, data);
      
      return data;
    } catch (error) {
      console.error(`❌ Failed to upload chunk ${chunkNumber}:`, error);
      // Re-add chunks back if upload fails
      this.chunks.unshift(...chunksToUpload);
      throw error;
    }
  }
  
  /**
   * Pause recording (keeps chunks in memory)
   */
  pause() {
    if (this.isRecording && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      console.log('Recording paused');
    }
  }
  
  /**
   * Resume recording
   */
  resume() {
    if (this.isRecording && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      console.log('Recording resumed');
    }
  }
  
  /**
   * Get current recording state
   */
  getState() {
    return {
      isRecording: this.isRecording,
      mediaRecorderState: this.mediaRecorder?.state,
      chunksInMemory: this.chunks.length,
      chunksUploaded: this.uploadedChunks
    };
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StreamRecorder;
}

