export default class ReplayBuffer {
    constructor(maxSize=100000) {
      this.maxSize = maxSize;
      this.buffer = [];
    }
  
    add(transition) {
      this.buffer.push(transition);
      if (this.buffer.length > this.maxSize) this.buffer.shift();
    }
  
    sample(batchSize) {
      const idxs = [];
      const len = this.buffer.length;
      for (let i=0;i<batchSize;i++) {
        idxs.push(Math.floor(Math.random()*len));
      }
      return idxs.map(i => this.buffer[i]);
    }
  
    size() { return this.buffer.length; }
  }
  