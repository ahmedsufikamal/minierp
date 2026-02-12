export interface QueueJob<T> {
  name: string;
  payload: T;
}

export interface JobQueue {
  enqueue<T>(job: QueueJob<T>): Promise<void>;
}

class InMemoryJobQueue implements JobQueue {
  async enqueue<T>(job: QueueJob<T>): Promise<void> {
    setTimeout(() => {
      void job;
    }, 0);
  }
}

let queueInstance: JobQueue | null = null;

export function getIamQueue(): JobQueue {
  if (queueInstance) return queueInstance;
  queueInstance = new InMemoryJobQueue();
  return queueInstance;
}
