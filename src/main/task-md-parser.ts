// Parser for project-implementation.md → Task data structures

export interface MdTaskComment {
  timestamp: string; // "YYYY-MM-DD HH:MM"
  text: string;
}

export interface MdTask {
  id: string;
  title: string;
  status: 'ideas' | 'todo' | 'in_progress' | 'done';
  category: string;
  body: string;
  feedback: MdTaskComment[];
  comments: MdTaskComment[];
}

export interface MdTaskFile {
  generated: string;
  spec: string;
  tasks: MdTask[];
}

const STATUS_MAP: Record<string, MdTask['status']> = {
  'todo': 'todo',
  'to do': 'todo',
  'ideas': 'ideas',
  'idea': 'ideas',
  'in progress': 'in_progress',
  'in_progress': 'in_progress',
  'done': 'done',
};

function normalizeStatus(raw: string): MdTask['status'] {
  return STATUS_MAP[raw.toLowerCase().trim()] || 'todo';
}

function parseEntries(section: string): MdTaskComment[] {
  const entries: MdTaskComment[] = [];
  const lines = section.split('\n');
  for (const line of lines) {
    const match = line.match(/^-\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*[—–-]\s*(.+)$/);
    if (match) {
      entries.push({ timestamp: match[1], text: match[2].trim() });
    }
  }
  return entries;
}

export function parseTaskMd(content: string): MdTaskFile {
  const result: MdTaskFile = { generated: '', spec: '', tasks: [] };

  // Split by --- separator
  const blocks = content.split(/^---$/m).map((b) => b.trim());

  // First block is the header
  if (blocks.length > 0) {
    const header = blocks[0];
    const genMatch = header.match(/>\s*Generated:\s*(.+)/);
    if (genMatch) result.generated = genMatch[1].trim();
    const specMatch = header.match(/>\s*Spec:\s*(.+)/);
    if (specMatch) result.spec = specMatch[1].trim();
  }

  // Remaining blocks are tasks
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;

    // Extract title from ## heading
    const titleMatch = block.match(/^##\s+(.+)$/m);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    // Extract fields
    const statusMatch = block.match(/\*\*Status:\*\*\s*(.+)/);
    const categoryMatch = block.match(/\*\*Category:\*\*\s*(.+)/);
    const idMatch = block.match(/\*\*ID:\*\*\s*(.+)/);

    const status = statusMatch ? normalizeStatus(statusMatch[1]) : 'todo';
    const category = categoryMatch ? categoryMatch[1].trim() : '';
    const id = idMatch ? idMatch[1].trim() : '';

    if (!id) continue; // Skip blocks without an ID

    // Extract body: everything between ID line and ### Feedback (or ### Comments or end)
    const idLineEnd = block.indexOf(idMatch![0]) + idMatch![0].length;
    const feedbackStart = block.indexOf('### Feedback');
    const commentsStart = block.indexOf('### Comments');

    let bodyEnd = block.length;
    if (feedbackStart !== -1) bodyEnd = feedbackStart;
    else if (commentsStart !== -1) bodyEnd = commentsStart;

    const body = block.substring(idLineEnd, bodyEnd).trim();

    // Extract feedback
    let feedback: MdTaskComment[] = [];
    if (feedbackStart !== -1) {
      const feedbackEnd = commentsStart !== -1 ? commentsStart : block.length;
      feedback = parseEntries(block.substring(feedbackStart, feedbackEnd));
    }

    // Extract comments
    let comments: MdTaskComment[] = [];
    if (commentsStart !== -1) {
      comments = parseEntries(block.substring(commentsStart));
    }

    result.tasks.push({ id, title, status, category, body, feedback, comments });
  }

  return result;
}
