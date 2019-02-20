import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

import { UploadxOptions, UploadState, UploadxControlEvent, UploaderOptions } from './interfaces';
import { Uploader } from './uploader';

/**
 *
 */
@Injectable({ providedIn: 'root' })
export class UploadxService {
  subj: Subject<UploadState> = new Subject();
  private queue: Uploader[] = [];
  uploaders = this.queue;
  private concurrency = 2;
  private autoUpload = true;
  private options: UploadxOptions;

  private get active() {
    return this.queue.filter(u => u.status !== 'complete' && u.status !== 'cancelled');
  }

  get uploaderOptions(): UploaderOptions {
    return {
      method: this.options.method || 'POST',
      // tslint:disable-next-line: deprecation
      endpoint: this.options.endpoint || this.options.url || '/upload/',
      // tslint:disable-next-line: deprecation
      url: this.options.endpoint || this.options.url || '/upload/',
      headers: this.options.headers,
      token: this.options.token,
      chunkSize: this.options.chunkSize || 0,
      withCredentials: this.options.withCredentials || false,
      subj: this.subj,
      nextFile: () => this.processQueue()
    };
  }
  /**
   * Set global module options
   */
  init(options: UploadxOptions): Observable<UploadState> {
    this.options = options;
    this.concurrency = options.concurrency || this.concurrency;
    this.autoUpload = options.autoUpload || false;
    return this.subj.asObservable();
  }
  /**
   *
   * Create Uploader and add to the queue
   */
  async handleFileList(fileList: FileList) {
    for (let i = 0; i < fileList.length; i++) {
      const uploader: Uploader = new Uploader(fileList.item(i), this.uploaderOptions);
      this.queue.push(uploader);
    }
    if (this.autoUpload) {
      for (const upload of this.queue) {
        await upload.upload();
      }
      this.processQueue();
    }
  }
  /**
   * Control upload status
   * @example
   * this.uploadService.control({ action: 'pauseAll' });
   *
   */
  control(event: UploadxControlEvent) {
    const id = event.itemOptions ? event.itemOptions.uploadId || event.uploadId : event.uploadId;
    const target = this.active.filter(f => f.uploadId === id);

    switch (event.action) {
      case 'upload':
        target.map(u => u.upload(event.itemOptions));
        this.processQueue();
        break;
      case 'cancel':
        target.map(u => (u.status = 'cancelled'));
        break;
      case 'pause':
        target.map(u => (u.status = 'paused'));
        break;
      case 'cancelAll':
        this.active.map(u => (u.status = 'cancelled'));
        break;
      case 'pauseAll':
        this.active.map(u => (u.status = 'paused'));
        break;
      case 'uploadAll':
        this.active.filter(u => u.status !== 'uploading').map(u => (u.status = 'queue'));
        this.processQueue();
        break;
      case 'refreshToken':
        this.queue.map(u => (u.options.token = event.token));
        break;
      default:
        break;
    }
  }
  /**
   * Queue management
   */
  private processQueue() {
    const running = this.queue.filter(u => u.status === 'uploading').length;
    this.queue
      .filter(u => u.status === 'queue')
      .slice(0, this.concurrency - running)
      .forEach(u => u.upload());
  }
}
