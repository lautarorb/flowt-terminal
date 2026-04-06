// Writer for Task data structures → project-implementation.md

import * as fs from 'fs';
import * as path from 'path';
import type { MdTask, MdTaskFile } from './task-md-parser';

function statusLabel(status: MdTask['status']): string {
  switch (status) {
    case 'ideas': return 'ideas';
    case 'todo': return 'todo';
    case 'in_progress': return 'in progress';
    case 'done': return 'done';
  }
}

function countByStatus(tasks: MdTask[], status: MdTask['status']): number {
  return tasks.filter((t) => t.status === status).length;
}

export function serializeTaskMd(file: MdTaskFile): string {
  const total = file.tasks.length;
  const todo = countByStatus(file.tasks, 'todo');
  const inProgress = countByStatus(file.tasks, 'in_progress');
  const done = countByStatus(file.tasks, 'done');
  const ideas = countByStatus(file.tasks, 'ideas');

  let out = '# Project Implementation\n\n';
  out += `> Generated: ${file.generated || new Date().toISOString().slice(0, 10)}\n`;
  out += `> Spec: ${file.spec}\n`;
  out += `> Total tasks: ${total} | Todo: ${todo} | In Progress: ${inProgress} | Done: ${done} | Ideas: ${ideas}\n`;

  for (const task of file.tasks) {
    out += '\n---\n\n';
    out += `## ${task.title}\n\n`;
    out += `**Status:** ${statusLabel(task.status)}\n`;
    out += `**Category:** ${task.category}\n`;
    out += `**ID:** ${task.id}\n`;

    if (task.body) {
      out += `\n${task.body}\n`;
    }

    out += '\n### Feedback\n';
    for (const f of task.feedback) {
      out += `- ${f.timestamp} — ${f.text}\n`;
    }

    out += '\n### Comments\n';
    for (const c of task.comments) {
      out += `- ${c.timestamp} — ${c.text}\n`;
    }
  }

  out += '\n---\n';

  return out;
}

export async function writeTaskMdAtomic(filePath: string, file: MdTaskFile): Promise<void> {
  const content = serializeTaskMd(file);
  const tmpPath = filePath + '.tmp';
  await fs.promises.writeFile(tmpPath, content, 'utf8');
  await fs.promises.rename(tmpPath, filePath);
}

export function generateTaskId(existingTasks: MdTask[]): string {
  let maxNum = 0;
  for (const t of existingTasks) {
    const match = t.id.match(/^task-(\d+)$/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNum) maxNum = num;
    }
  }
  return `task-${String(maxNum + 1).padStart(3, '0')}`;
}
