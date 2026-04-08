import fs from 'node:fs';

export type LiveTestAccount = 'stake' | 'ward' | 'branch';

interface LiveCredentials {
  account: LiveTestAccount;
  accountLabel: string;
  email: string;
  password: string;
  source: 'env' | 'note';
}

const CREDENTIALS_NOTE_PATH =
  process.env.SURREYALIGN_TEST_CREDENTIALS_NOTE
  || '/home/webadmin/.codex/memories/surreyalign-test-credentials.md';

const ACCOUNT_LABELS: Record<LiveTestAccount, string> = {
  stake: 'Stake leader',
  ward: 'Ward leader',
  branch: 'Branch leader',
};

function readConfiguredAccount(): LiveTestAccount {
  const requested = (process.env.PWA_E2E_ACCOUNT || 'stake').trim().toLowerCase();

  if (requested === 'stake' || requested === 'ward' || requested === 'branch') {
    return requested;
  }

  throw new Error(
    `Unsupported PWA_E2E_ACCOUNT "${requested}". Use stake, ward, or branch.`,
  );
}

function readFromEnvironment(account: LiveTestAccount): LiveCredentials | null {
  const email = process.env.PWA_E2E_EMAIL?.trim();
  const password = process.env.PWA_E2E_PASSWORD?.trim();

  if (!email && !password) {
    return null;
  }

  if (!email || !password) {
    throw new Error(
      'Set both PWA_E2E_EMAIL and PWA_E2E_PASSWORD together, or leave both unset.',
    );
  }

  return {
    account,
    accountLabel: ACCOUNT_LABELS[account],
    email,
    password,
    source: 'env',
  };
}

function readNoteContents(): string {
  if (!fs.existsSync(CREDENTIALS_NOTE_PATH)) {
    throw new Error(
      `Missing SurreyAlign test credentials note at ${CREDENTIALS_NOTE_PATH}.`,
    );
  }

  return fs.readFileSync(CREDENTIALS_NOTE_PATH, 'utf-8');
}

function parseAccountCredentials(noteText: string, account: LiveTestAccount): LiveCredentials {
  const label = ACCOUNT_LABELS[account];
  const lines = noteText.split(/\r?\n/);

  let inRequestedBlock = false;
  let email: string | null = null;
  let password: string | null = null;

  for (const line of lines) {
    if (line.trim() === `- ${label}`) {
      inRequestedBlock = true;
      continue;
    }

    if (inRequestedBlock && /^- /.test(line)) {
      break;
    }

    if (!inRequestedBlock) {
      continue;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith('- Email:')) {
      email = trimmed.slice('- Email:'.length).trim();
    }

    if (trimmed.startsWith('- Password:')) {
      password = trimmed.slice('- Password:'.length).trim();
    }
  }

  if (!email || !password) {
    throw new Error(
      `Could not find email and password for "${label}" in ${CREDENTIALS_NOTE_PATH}.`,
    );
  }

  return {
    account,
    accountLabel: label,
    email,
    password,
    source: 'note',
  };
}

export function getLiveCredentials(): LiveCredentials {
  const account = readConfiguredAccount();
  const envCredentials = readFromEnvironment(account);

  if (envCredentials) {
    return envCredentials;
  }

  return parseAccountCredentials(readNoteContents(), account);
}
