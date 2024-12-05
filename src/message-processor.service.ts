import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MessageProcessorService {
  constructor(private eventEmitter: EventEmitter2) {}

  async processMessage(message: any): Promise<void> {
    this.eventEmitter.emit('MessageReceived', message);
    console.log(`Processing message: ${JSON.stringify(message)}`);
  }
}
