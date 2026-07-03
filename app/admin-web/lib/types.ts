export type DashboardCards = {
  totalUsersRegistered: number;
  totalAssessmentsCompleted: number;
  totalAssessmentsInProgress: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  activeSharedCodes: number;
};

export type RecentResult = {
  _id: string;
  totalMarks: number;
  level: string;
  createdAt: string;
  userId?: { name: string; email: string; sharedCode: string };
};

export type DashboardData = {
  cards: DashboardCards;
  barChart: { labels: string[]; data: number[] };
  pieChart: { labels: string[]; data: number[] };
  recentResults: RecentResult[];
};
