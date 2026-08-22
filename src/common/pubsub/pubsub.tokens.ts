export const MQ_EMITTER = Symbol('MQ_EMITTER');

interface MqEmitterMessage {
  topic: string;
  [key: string]: unknown;
}

export interface MqEmitter {
  emit(message: MqEmitterMessage, callback?: (error?: Error) => void): void;
  on(
    topic: string,
    listener: (message: MqEmitterMessage, callback: () => void) => void,
    done?: () => void,
  ): void;
  removeListener(
    topic: string,
    listener: (message: MqEmitterMessage, callback: () => void) => void,
    done?: () => void,
  ): void;
  close(callback: () => void): void;
}

export const ANNOUNCEMENT_CHANGED_TOPIC = 'announcement.changed';
export const NOTIFICATION_CREATED_TOPIC = 'notification.created';
