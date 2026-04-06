import { parseTaskMd, MdTaskFile, MdTask } from '../../src/main/task-md-parser';
import { serializeTaskMd, generateTaskId } from '../../src/main/task-md-writer';

function makeTask(overrides: Partial<MdTask> = {}): MdTask {
  return {
    id: 'task-001',
    title: 'Test task',
    status: 'todo',
    category: 'General',
    body: 'Task description here.',
    feedback: [],
    comments: [],
    ...overrides,
  };
}

function makeFile(overrides: Partial<MdTaskFile> = {}): MdTaskFile {
  return {
    generated: '2026-03-31',
    spec: 'my-spec.md',
    tasks: [],
    ...overrides,
  };
}

describe('serializeTaskMd', () => {
  it('produces valid header with counts', () => {
    const file = makeFile({
      tasks: [
        makeTask({ id: 'task-001', status: 'todo' }),
        makeTask({ id: 'task-002', status: 'in_progress' }),
        makeTask({ id: 'task-003', status: 'done' }),
        makeTask({ id: 'task-004', status: 'ideas' }),
      ],
    });
    const output = serializeTaskMd(file);
    expect(output).toContain('> Total tasks: 4 | Todo: 1 | In Progress: 1 | Done: 1 | Ideas: 1');
  });

  it('writes status as readable label', () => {
    const file = makeFile({ tasks: [makeTask({ status: 'in_progress' })] });
    const output = serializeTaskMd(file);
    expect(output).toContain('**Status:** in progress');
  });

  it('writes task with all fields', () => {
    const file = makeFile({
      tasks: [makeTask({
        title: 'Auth middleware',
        status: 'todo',
        category: 'Backend',
        id: 'task-042',
        body: 'Configure all routes.',
        feedback: [{ timestamp: '2026-03-31 14:00', text: 'Looks good' }],
        comments: [{ timestamp: '2026-03-31 10:42', text: 'Started' }],
      })],
    });
    const output = serializeTaskMd(file);
    expect(output).toContain('## Auth middleware');
    expect(output).toContain('**Status:** todo');
    expect(output).toContain('**Category:** Backend');
    expect(output).toContain('**ID:** task-042');
    expect(output).toContain('Configure all routes.');
    expect(output).toContain('- 2026-03-31 14:00 — Looks good');
    expect(output).toContain('- 2026-03-31 10:42 — Started');
  });

  it('writes empty Feedback and Comments sections', () => {
    const file = makeFile({ tasks: [makeTask()] });
    const output = serializeTaskMd(file);
    expect(output).toContain('### Feedback\n');
    expect(output).toContain('### Comments\n');
  });

  it('ends with ---', () => {
    const file = makeFile({ tasks: [makeTask()] });
    const output = serializeTaskMd(file);
    expect(output.trimEnd().endsWith('---')).toBe(true);
  });

  it('separates tasks with ---', () => {
    const file = makeFile({
      tasks: [
        makeTask({ id: 'task-001', title: 'First' }),
        makeTask({ id: 'task-002', title: 'Second' }),
      ],
    });
    const output = serializeTaskMd(file);
    const parts = output.split('---');
    // header, task1, task2, final empty
    expect(parts.length).toBeGreaterThanOrEqual(4);
  });

  it('handles empty body', () => {
    const file = makeFile({ tasks: [makeTask({ body: '' })] });
    const output = serializeTaskMd(file);
    expect(output).toContain('**ID:** task-001\n\n### Feedback');
  });
});

describe('round-trip fidelity', () => {
  it('parse → serialize → parse produces identical tasks', () => {
    const original = makeFile({
      tasks: [
        makeTask({
          id: 'task-001',
          title: 'Auth middleware',
          status: 'todo',
          category: 'Backend',
          body: 'Configure middleware for all protected routes.\n\nMultiple paragraphs.',
          feedback: [
            { timestamp: '2026-03-31 14:00', text: 'Looks good, proceed' },
            { timestamp: '2026-03-31 15:30', text: 'Needs CORS headers too' },
          ],
          comments: [
            { timestamp: '2026-03-31 10:42', text: 'Started investigating options' },
          ],
        }),
        makeTask({
          id: 'task-002',
          title: 'Design landing page',
          status: 'in_progress',
          category: 'Design',
          body: 'Create wireframes.',
          feedback: [],
          comments: [{ timestamp: '2026-03-31 09:00', text: 'First draft ready' }],
        }),
        makeTask({
          id: 'task-003',
          title: 'Write tests',
          status: 'done',
          category: 'Testing',
          body: 'Cover edge cases.',
          feedback: [{ timestamp: '2026-04-01 08:00', text: 'All green' }],
          comments: [],
        }),
      ],
    });

    const serialized = serializeTaskMd(original);
    const reparsed = parseTaskMd(serialized);

    expect(reparsed.generated).toBe(original.generated);
    expect(reparsed.spec).toBe(original.spec);
    expect(reparsed.tasks).toHaveLength(original.tasks.length);

    for (let i = 0; i < original.tasks.length; i++) {
      const orig = original.tasks[i];
      const re = reparsed.tasks[i];
      expect(re.id).toBe(orig.id);
      expect(re.title).toBe(orig.title);
      expect(re.status).toBe(orig.status);
      expect(re.category).toBe(orig.category);
      expect(re.body).toBe(orig.body);
      expect(re.feedback).toEqual(orig.feedback);
      expect(re.comments).toEqual(orig.comments);
    }
  });

  it('parse → serialize → parse with empty file', () => {
    const original = makeFile({ tasks: [] });
    const serialized = serializeTaskMd(original);
    const reparsed = parseTaskMd(serialized);
    expect(reparsed.tasks).toHaveLength(0);
    expect(reparsed.generated).toBe(original.generated);
  });

  it('parse → serialize → parse with empty body, feedback, comments', () => {
    const original = makeFile({
      tasks: [makeTask({ body: '', feedback: [], comments: [] })],
    });
    const serialized = serializeTaskMd(original);
    const reparsed = parseTaskMd(serialized);
    expect(reparsed.tasks[0].body).toBe('');
    expect(reparsed.tasks[0].feedback).toEqual([]);
    expect(reparsed.tasks[0].comments).toEqual([]);
  });

  it('serialize → parse → serialize produces identical output', () => {
    const file = makeFile({
      tasks: [
        makeTask({
          id: 'task-001',
          title: 'A task',
          body: 'Body text\n\nWith **markdown** and `code`.',
          feedback: [{ timestamp: '2026-01-01 10:00', text: 'Good' }],
          comments: [{ timestamp: '2026-01-01 11:00', text: 'Done' }],
        }),
      ],
    });
    const first = serializeTaskMd(file);
    const parsed = parseTaskMd(first);
    const second = serializeTaskMd(parsed);
    expect(second).toBe(first);
  });

  it('full file round-trip: parse real file → serialize → parse again', () => {
    const realFile = `# Project Implementation

> Generated: 2026-03-31
> Spec: feature-spec.md
> Total tasks: 2 | Todo: 1 | In Progress: 0 | Done: 1 | Ideas: 0

---

## Implement auth

**Status:** todo
**Category:** Phase 1
**ID:** task-001

Set up JWT tokens and session management.

Use RS256 algorithm.

### Feedback
- 2026-03-31 12:00 — Approved by security team

### Comments
- 2026-03-31 10:00 — Reviewed existing code
- 2026-03-31 10:30 — Need to update dependencies first

---

## Set up CI

**Status:** done
**Category:** DevOps
**ID:** task-002

Configure GitHub Actions pipeline.

### Feedback

### Comments
- 2026-03-30 16:00 — Pipeline is green

---`;

    const parsed = parseTaskMd(realFile);
    expect(parsed.tasks).toHaveLength(2);

    const serialized = serializeTaskMd(parsed);
    const reparsed = parseTaskMd(serialized);

    expect(reparsed.tasks).toHaveLength(2);
    expect(reparsed.tasks[0].id).toBe('task-001');
    expect(reparsed.tasks[0].title).toBe('Implement auth');
    expect(reparsed.tasks[0].body).toContain('RS256 algorithm');
    expect(reparsed.tasks[0].feedback).toHaveLength(1);
    expect(reparsed.tasks[0].comments).toHaveLength(2);
    expect(reparsed.tasks[1].id).toBe('task-002');
    expect(reparsed.tasks[1].status).toBe('done');
  });
});

describe('generateTaskId', () => {
  it('generates task-001 for empty list', () => {
    expect(generateTaskId([])).toBe('task-001');
  });

  it('increments from highest existing ID', () => {
    const tasks = [makeTask({ id: 'task-003' }), makeTask({ id: 'task-001' })];
    expect(generateTaskId(tasks)).toBe('task-004');
  });

  it('pads with leading zeros', () => {
    const tasks = [makeTask({ id: 'task-009' })];
    expect(generateTaskId(tasks)).toBe('task-010');
  });

  it('handles non-standard IDs gracefully', () => {
    const tasks = [makeTask({ id: 'custom-id' }), makeTask({ id: 'task-005' })];
    expect(generateTaskId(tasks)).toBe('task-006');
  });
});
