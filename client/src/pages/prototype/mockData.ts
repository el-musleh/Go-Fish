export const mockConfirmation = {
  venue: 'Hall of Soccer GmbH',
  location: 'Landsberger Allee 77, 10249 Berlin',
  cost: '34 Euro',
  perPerson: '2.61 Euro',
  paymentStatus: 'Pending collection',
  organizer: 'Max Mustermann',
  duration: '2 hours',
  participants: 13,
};

export type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  participants: number;
  location: string;
  cost: string;
  perPerson: string;
  paymentStatus: string;
  organizer: string;
  duration: string;
  description: string;
};

export const mockTimelineEvents: TimelineEvent[] = [
  {
    id: '1',
    date: 'May 04, 2026',
    title: 'Football Match',
    participants: 13,
    location: 'Hall of Soccer GmbH, Berlin',
    cost: '34 Euro',
    perPerson: '2.61 Euro',
    paymentStatus: 'Pending collection',
    organizer: 'Max Mustermann',
    duration: '2 hours',
    description:
      'Weekly 5-a-side football match at the indoor hall. Bring your own cleats and shin guards. Water bottles provided.',
  },
  {
    id: '2',
    date: 'May 04, 2026',
    title: 'Rooftop Dinner',
    participants: 8,
    location: 'Sky Kitchen, Mitte Berlin',
    cost: '240 Euro',
    perPerson: '30 Euro',
    paymentStatus: 'Paid',
    organizer: 'Sarah Chen',
    duration: '3 hours',
    description:
      'End-of-sprint celebration dinner on the rooftop. Dress code: smart casual. Reservation confirmed.',
  },
  {
    id: '3',
    date: 'May 28, 2026',
    title: 'Mini Golf Tournament',
    participants: 10,
    location: 'Tropical Islands, Brandenburg',
    cost: '150 Euro',
    perPerson: '15 Euro',
    paymentStatus: 'Pending collection',
    organizer: 'Muhamad Ibrahim',
    duration: '4 hours',
    description:
      '18-hole mini golf tournament followed by a BBQ. Teams of 2. Winner gets bragging rights and a trophy.',
  },
];

export type MemoryContent = {
  season: string;
  setting: 'Indoor' | 'Outdoor' | 'Both';
  checklist: string[];
  essentials: string;
  feedback: string;
};

export const mockCategories = ['Activities', 'Countries', 'Restaurants', 'Games', 'Music'];

export const mockItems: Record<string, string[]> = {
  Activities: ['Football', 'Tennis', 'Mini-golf', 'Cycling', 'Rock Climbing'],
  Countries: ['Germany', 'Spain', 'Japan', 'Portugal', 'Netherlands'],
  Restaurants: ['Italian Nights', 'Sushi Friday', 'Taco Tuesday', 'Ramen House'],
  Games: ['Poker Night', 'Board Games', 'Escape Room', 'Trivia Quiz'],
  Music: ['Jazz Sessions', 'Open Mic', 'Concert Outing'],
};

export const mockMemoryContent: Record<string, MemoryContent> = {
  Football: {
    season: 'Spring / Fall',
    setting: 'Indoor',
    checklist: [
      'Reserve the pitch (at least 2 weeks ahead)',
      'Collect payment before the event',
      'Bring bibs / training vests',
      'Water bottles for everyone',
      'First aid kit',
    ],
    essentials: 'Cleats, shin guards, ball pump, cones for warm-up drills.',
    feedback:
      'Everyone loved the 5-a-side format. Consider booking Astroturf next time for rainy days. Start 30 min earlier to avoid rush hour.',
  },
  Germany: {
    season: 'Year-round',
    setting: 'Both',
    checklist: [
      'Check public holiday calendar',
      'Book trains in advance (Deutsche Bahn)',
      'Carry cash — many places are cash only',
      'Validate train tickets before boarding',
    ],
    essentials: 'EU health card or travel insurance, comfortable walking shoes, reusable bag.',
    feedback:
      'Berlin is excellent for group trips. Munich is great in October (Oktoberfest). Hamburg for summer weekends.',
  },
  Tennis: {
    season: 'Spring / Summer',
    setting: 'Outdoor',
    checklist: [
      'Book courts at least 1 week ahead',
      'Bring extra tennis balls',
      'Check net height before play',
      'Sunscreen for outdoor courts',
    ],
    essentials: 'Rackets, tennis balls, non-marking shoes, towel.',
    feedback: 'Mixed skill levels worked well with handicap scoring. Round-robin format recommended for 6+ players.',
  },
};
