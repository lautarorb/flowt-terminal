import { parseTaskMd, MdTaskFile } from '../../src/main/task-md-parser';

const FULL_FILE = `# Project Implementation

> Generated: 2026-03-31
> Spec: my-spec.md
> Total tasks: 3 | Todo: 1 | In Progress: 1 | Done: 1 | Ideas: 0

---

## Set up auth middleware

**Status:** todo
**Category:** Backend
**ID:** task-001

Configure middleware for all protected routes.
Multiple paragraphs are supported.

This is the second paragraph.

### Feedback
- 2026-03-31 14:00 — Looks good, proceed
- 2026-03-31 15:30 — Needs CORS headers too

### Comments
- 2026-03-31 10:42 — Started investigating options
- 2026-03-31 11:00 — Using express middleware

---

## Design landing page

**Status:** in progress
**Category:** Design
**ID:** task-002

Create wireframes for the new landing page.

### Feedback

### Comments
- 2026-03-31 09:00 — First draft ready

---

## Write tests

**Status:** done
**Category:** Testing
**ID:** task-003

Cover happy path + edge cases.

### Feedback
- 2026-04-01 08:00 — All green

### Comments

---`;

describe('parseTaskMd', () => {
  describe('header parsing', () => {
    it('extracts generated date', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.generated).toBe('2026-03-31');
    });

    it('extracts spec filename', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.spec).toBe('my-spec.md');
    });

    it('handles empty header gracefully', () => {
      const result = parseTaskMd('---\n\n## Task\n\n**Status:** todo\n**Category:** X\n**ID:** task-001\n\nBody\n\n### Feedback\n\n### Comments\n\n---');
      expect(result.generated).toBe('');
      expect(result.spec).toBe('');
    });
  });

  describe('task parsing', () => {
    it('parses all three tasks', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks).toHaveLength(3);
    });

    it('extracts task title', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[0].title).toBe('Set up auth middleware');
      expect(result.tasks[1].title).toBe('Design landing page');
      expect(result.tasks[2].title).toBe('Write tests');
    });

    it('extracts task ID', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[0].id).toBe('task-001');
      expect(result.tasks[1].id).toBe('task-002');
      expect(result.tasks[2].id).toBe('task-003');
    });

    it('extracts task status', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[0].status).toBe('todo');
      expect(result.tasks[1].status).toBe('in_progress');
      expect(result.tasks[2].status).toBe('done');
    });

    it('extracts task category', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[0].category).toBe('Backend');
      expect(result.tasks[1].category).toBe('Design');
      expect(result.tasks[2].category).toBe('Testing');
    });

    it('extracts multi-paragraph body', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[0].body).toContain('Configure middleware for all protected routes.');
      expect(result.tasks[0].body).toContain('This is the second paragraph.');
    });

    it('extracts single-line body', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[2].body).toBe('Cover happy path + edge cases.');
    });

    it('body does not include feedback or comments sections', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[0].body).not.toContain('### Feedback');
      expect(result.tasks[0].body).not.toContain('### Comments');
      expect(result.tasks[0].body).not.toContain('Looks good');
    });
  });

  describe('feedback parsing', () => {
    it('extracts multiple feedback entries', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[0].feedback).toHaveLength(2);
      expect(result.tasks[0].feedback[0].timestamp).toBe('2026-03-31 14:00');
      expect(result.tasks[0].feedback[0].text).toBe('Looks good, proceed');
      expect(result.tasks[0].feedback[1].timestamp).toBe('2026-03-31 15:30');
      expect(result.tasks[0].feedback[1].text).toBe('Needs CORS headers too');
    });

    it('handles empty feedback section', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[1].feedback).toHaveLength(0);
    });

    it('extracts single feedback entry', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[2].feedback).toHaveLength(1);
      expect(result.tasks[2].feedback[0].text).toBe('All green');
    });
  });

  describe('comments parsing', () => {
    it('extracts multiple comment entries', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[0].comments).toHaveLength(2);
      expect(result.tasks[0].comments[0].timestamp).toBe('2026-03-31 10:42');
      expect(result.tasks[0].comments[0].text).toBe('Started investigating options');
    });

    it('handles empty comments section', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[2].comments).toHaveLength(0);
    });

    it('extracts single comment entry', () => {
      const result = parseTaskMd(FULL_FILE);
      expect(result.tasks[1].comments).toHaveLength(1);
      expect(result.tasks[1].comments[0].text).toBe('First draft ready');
    });
  });

  describe('status normalization', () => {
    it('normalizes "in progress" to in_progress', () => {
      const md = `---\n\n## Task\n\n**Status:** in progress\n**Category:** X\n**ID:** t-1\n\nBody\n\n### Feedback\n\n### Comments\n\n---`;
      expect(parseTaskMd(md).tasks[0].status).toBe('in_progress');
    });

    it('normalizes "To Do" case-insensitively', () => {
      const md = `---\n\n## Task\n\n**Status:** To Do\n**Category:** X\n**ID:** t-1\n\nBody\n\n### Feedback\n\n### Comments\n\n---`;
      expect(parseTaskMd(md).tasks[0].status).toBe('todo');
    });

    it('normalizes "Ideas" case-insensitively', () => {
      const md = `---\n\n## Task\n\n**Status:** Ideas\n**Category:** X\n**ID:** t-1\n\nBody\n\n### Feedback\n\n### Comments\n\n---`;
      expect(parseTaskMd(md).tasks[0].status).toBe('ideas');
    });

    it('defaults unknown status to todo', () => {
      const md = `---\n\n## Task\n\n**Status:** unknown-status\n**Category:** X\n**ID:** t-1\n\nBody\n\n### Feedback\n\n### Comments\n\n---`;
      expect(parseTaskMd(md).tasks[0].status).toBe('todo');
    });
  });

  describe('edge cases', () => {
    it('handles empty file', () => {
      const result = parseTaskMd('');
      expect(result.tasks).toHaveLength(0);
      expect(result.generated).toBe('');
    });

    it('handles file with only header', () => {
      const result = parseTaskMd('# Project Implementation\n\n> Generated: 2026-01-01\n> Spec: test.md\n\n---');
      expect(result.tasks).toHaveLength(0);
      expect(result.generated).toBe('2026-01-01');
    });

    it('skips blocks without an ID', () => {
      const md = `---\n\n## No ID Task\n\n**Status:** todo\n**Category:** X\n\nBody without ID\n\n---`;
      const result = parseTaskMd(md);
      expect(result.tasks).toHaveLength(0);
    });

    it('skips blocks without a ## title', () => {
      const md = `---\n\nSome random content without a heading\n\n**Status:** todo\n**Category:** X\n**ID:** t-1\n\n---`;
      const result = parseTaskMd(md);
      expect(result.tasks).toHaveLength(0);
    });

    it('handles missing Feedback section', () => {
      const md = `---\n\n## Task\n\n**Status:** todo\n**Category:** X\n**ID:** t-1\n\nBody\n\n### Comments\n- 2026-01-01 10:00 — A comment\n\n---`;
      const result = parseTaskMd(md);
      expect(result.tasks[0].feedback).toHaveLength(0);
      expect(result.tasks[0].comments).toHaveLength(1);
    });

    it('handles missing Comments section', () => {
      const md = `---\n\n## Task\n\n**Status:** todo\n**Category:** X\n**ID:** t-1\n\nBody\n\n### Feedback\n- 2026-01-01 10:00 — Some feedback\n\n---`;
      const result = parseTaskMd(md);
      expect(result.tasks[0].feedback).toHaveLength(1);
      expect(result.tasks[0].comments).toHaveLength(0);
    });

    it('handles missing both Feedback and Comments', () => {
      const md = `---\n\n## Task\n\n**Status:** todo\n**Category:** X\n**ID:** t-1\n\nBody only\n\n---`;
      const result = parseTaskMd(md);
      expect(result.tasks[0].body).toBe('Body only');
      expect(result.tasks[0].feedback).toHaveLength(0);
      expect(result.tasks[0].comments).toHaveLength(0);
    });

    it('handles body with markdown formatting', () => {
      const body = '**Bold text** and `code` and\n\n- bullet 1\n- bullet 2\n\n1. numbered\n2. list';
      const md = `---\n\n## Task\n\n**Status:** todo\n**Category:** X\n**ID:** t-1\n\n${body}\n\n### Feedback\n\n### Comments\n\n---`;
      const result = parseTaskMd(md);
      expect(result.tasks[0].body).toBe(body);
    });

    it('handles em dash, en dash, and regular dash in entries', () => {
      const md = `---\n\n## Task\n\n**Status:** todo\n**Category:** X\n**ID:** t-1\n\nBody\n\n### Feedback\n- 2026-01-01 10:00 — em dash entry\n- 2026-01-01 11:00 – en dash entry\n- 2026-01-01 12:00 - regular dash entry\n\n### Comments\n\n---`;
      const result = parseTaskMd(md);
      expect(result.tasks[0].feedback).toHaveLength(3);
      expect(result.tasks[0].feedback[0].text).toBe('em dash entry');
      expect(result.tasks[0].feedback[1].text).toBe('en dash entry');
      expect(result.tasks[0].feedback[2].text).toBe('regular dash entry');
    });

    it('preserves empty body', () => {
      const md = `---\n\n## Task\n\n**Status:** todo\n**Category:** X\n**ID:** t-1\n\n### Feedback\n\n### Comments\n\n---`;
      const result = parseTaskMd(md);
      expect(result.tasks[0].body).toBe('');
    });
  });
});
