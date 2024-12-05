import os from 'os';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { OnEvent } from '@nestjs/event-emitter';
import path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as util from 'util';
import { Upload } from '@aws-sdk/lib-storage';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // To check locally, import ffmpeg & create /tmp in root directory
  private ffmpegPath = '/opt/ffmpeg/ffmpeg'; // path.resolve(__dirname, '../', 'ffmpeg/ffmpeg');
  private tempDirectory = os.tmpdir(); // path.resolve(__dirname, '../', 'tmp');
  private inputFileName = '';
  private outputFileName = '';
  private s3Bucket = '';
  private s3Key = '';

  @Get()
  @OnEvent('MessageReceived')
  async getHello(message: any): Promise<string> {
    if (message) {
      console.log(this.appService.getHello(), JSON.stringify(message));
    }

    const credentials = {
      region: 'ap-south-1',
      credentials: {
        accessKeyId: '',
        secretAccessKey: '',
      },
    };

    const s3Client = new S3Client(credentials);

    const tempInputFilePath = path.join(this.tempDirectory, this.inputFileName);
    const tempOutputFilePath = path.join(
      this.tempDirectory,
      this.outputFileName,
    );

    await this.downloadFileFromS3(
      s3Client,
      this.s3Bucket,
      this.s3Key,
      tempInputFilePath,
    );

    const ffmpegArgs = ['-i', tempInputFilePath, tempOutputFilePath];

    try {
      await this.runFfmpeg(ffmpegArgs);
      console.log('Successfully processed file', tempOutputFilePath);

      /* const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: this.outputFileName,
        ContentType: 'image/gif',
      });

      await s3Client.send(command); */
      await this.uploadFile(
        s3Client,
        tempOutputFilePath,
        this.s3Bucket,
        this.outputFileName,
      );
      await this.deleteFile(tempInputFilePath);
      await this.deleteFile(tempOutputFilePath);
    } catch (error) {
      console.error(`Error processing message: ${error}`);
    }

    return this.appService.getHello();
  }

  private async downloadFileFromS3(
    s3Client: S3Client,
    bucket: string,
    key: string,
    destinationPath: string,
  ): Promise<void> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });

    try {
      const response = await s3Client.send(command);

      if (response.Body) {
        const writeStream = fs.createWriteStream(destinationPath);
        const stream = response.Body as NodeJS.ReadableStream;

        const pipeline = util.promisify(require('stream').pipeline);
        await pipeline(stream, writeStream);

        console.log(`File downloaded to ${destinationPath}`);
      } else {
        throw new Error('No file content received from S3');
      }
    } catch (error) {
      console.error('Error downloading file from S3:', error);
      throw error;
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegProcess: ChildProcess = spawn(this.ffmpegPath, args);

      ffmpegProcess.stdout.on('data', (data) => {
        console.log(`ffmpeg output: ${data}`);
      });

      ffmpegProcess.stderr.on('data', (data) => {
        console.error(`ffmpeg error: ${data}`);
      });

      ffmpegProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg process exited with code ${code}`));
        } else {
          resolve();
        }
      });
    });
  }

  async deleteFile(filePath) {
    try {
      fs.unlink(filePath, (err) => {
        console.error(`Failed to delete file: ${err.message}`);
      });
      console.log('File successfully deleted.');
    } catch (err) {}
  }

  async uploadFile(
    s3Client: any,
    filePath: string,
    bucketName: string,
    key: string,
  ) {
    const fileStream = fs.createReadStream(filePath);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: key,
        Body: fileStream,
      },
    });

    upload.on('httpUploadProgress', (progress) => {
      console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
    });

    try {
      await upload.done();
      console.log('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file', error);
    }
  }
}
