export type Chapter = { id: string; number: number; title: string; duration: string; isAvailable?: boolean };

export type Book = {
  id: string;
  title: string;
  author: string;
  coverColor: string;
  coverLabel: string;
  progress: number;
  currentChapter: string;
  totalChapters: number;
  duration: string;
  remainingTime: string;
  isFavorite: boolean;
  isDownloaded: boolean;
  description: string;
  chapters: Chapter[];
};

export type LibraryFilter = 'All' | 'In Progress' | 'Finished' | 'Favorites' | 'Downloaded';
