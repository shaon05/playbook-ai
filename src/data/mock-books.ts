import type { Book } from '@/types/library';

const chapterTitles = ['The Man Who Didn’t Look Right', 'The 1% Rule', 'The Best Way to Start', 'How to Stay Consistent', 'The Role of Environment', 'Make It Satisfying', 'The Goldilocks Rule', 'Never Miss Twice'];

const chapters = (prefix: string) => chapterTitles.map((title, index) => ({ id: `${prefix}-${index + 1}`, number: index + 1, title, duration: `${8 + index * 3}:0${index}`, isAvailable: index < 5 }));

export const mockBooks: Book[] = [
  { id: 'atomic-habits', title: 'Atomic Habits', author: 'James Clear', coverColor: '#D8A34A', coverLabel: 'ATOMIC\nHABITS', progress: 72, currentChapter: 'Chapter 4 · The Man Who Didn’t Look Right', totalChapters: 8, duration: '5h 35m', remainingTime: '1h 34m left', isFavorite: true, isDownloaded: true, description: 'An approachable guide to building better habits through small, repeatable changes that compound over time.', chapters: chapters('atomic') },
  { id: 'four-thousand-weeks', title: 'Four Thousand Weeks', author: 'Oliver Burkeman', coverColor: '#287E7A', coverLabel: '4000\nWEEKS', progress: 18, currentChapter: 'Chapter 2 · The Efficiency Trap', totalChapters: 10, duration: '6h 12m', remainingTime: '5h 04m left', isFavorite: false, isDownloaded: false, description: 'A clear-eyed, humane look at making a meaningful life within the limits of our finite time.', chapters: chapters('weeks') },
  { id: 'the-creative-act', title: 'The Creative Act', author: 'Rick Rubin', coverColor: '#7054C9', coverLabel: 'THE\nCREATIVE\nACT', progress: 0, currentChapter: 'Chapter 1 · Everyone Is a Creator', totalChapters: 9, duration: '5h 48m', remainingTime: '5h 48m left', isFavorite: true, isDownloaded: false, description: 'A generous invitation to approach creative work with curiosity, attention, and trust.', chapters: chapters('creative') },
  { id: 'stillness-is-key', title: 'Stillness Is the Key', author: 'Ryan Holiday', coverColor: '#B85D67', coverLabel: 'STILLNESS\nIS THE KEY', progress: 100, currentChapter: 'Finished', totalChapters: 12, duration: '4h 21m', remainingTime: 'Finished', isFavorite: false, isDownloaded: true, description: 'Practical wisdom for finding focus and calm in a noisy world.', chapters: chapters('stillness') },
  { id: 'deep-work', title: 'Deep Work', author: 'Cal Newport', coverColor: '#356A9A', coverLabel: 'DEEP\nWORK', progress: 46, currentChapter: 'Chapter 5 · Embrace Boredom', totalChapters: 7, duration: '7h 12m', remainingTime: '3h 53m left', isFavorite: false, isDownloaded: true, description: 'Rules for focused success in a distracted world.', chapters: chapters('deep') },
  { id: 'the-comfort-book', title: 'The Comfort Book', author: 'Matt Haig', coverColor: '#CA805B', coverLabel: 'THE\nCOMFORT\nBOOK', progress: 0, currentChapter: 'Chapter 1 · A Note to Self', totalChapters: 14, duration: '3h 07m', remainingTime: '3h 07m left', isFavorite: false, isDownloaded: false, description: 'Small thoughts and reminders for difficult days and hopeful ones.', chapters: chapters('comfort') },
];

export const mockUser = { name: 'Alex', email: 'alex@example.com', plan: 'Free' };

export function findBook(bookId?: string) { return mockBooks.find((book) => book.id === bookId); }
