import { EventEmitter } from "node:events";
import type {
  Comment,
  Task,
  User,
} from "../../../generated/prisma/client.js";

export type TaskEvents = {
  "task.created": { task: Task; actor: User };
  "task.moved": {
    task: Task;
    fromColumnId: string;
    toColumnId: string;
    actor: User;
  };
  "task.assigned": { task: Task; assignee: User; actor: User };
  "task.deadline.near": { task: Task; assignee: User };
  "task.completed": { task: Task; owner: User; actor: User };
  "task.commented": {
    task: Task;
    comment: Comment;
    assignee: User;
    actor: User;
  };
};

class TypedTaskEventEmitter {
  private readonly emitter = new EventEmitter();

  on<K extends keyof TaskEvents>(
    event: K,
    handler: (payload: TaskEvents[K]) => void | Promise<void>,
  ): void {
    this.emitter.on(event, handler);
  }

  off<K extends keyof TaskEvents>(
    event: K,
    handler: (payload: TaskEvents[K]) => void | Promise<void>,
  ): void {
    this.emitter.off(event, handler);
  }

  emit<K extends keyof TaskEvents>(event: K, payload: TaskEvents[K]): void {
    this.emitter.emit(event, payload);
  }
}

export const taskEvents = new TypedTaskEventEmitter();
