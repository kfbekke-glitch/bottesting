
import { Barber, Service, TimeSlot } from './types';

// Master List of Service Definitions
export const SERVICES: Service[] = [
  {
    id: 's1',
    name: 'Мужская Стрижка',
    description: 'Мытье, стрижка, укладка. Классика или Фейд.',
  },
  {
    id: 's2',
    name: 'Оформление Бороды',
    description: 'Коррекция длины и контуров. Бритье шейки.',
  },
  {
    id: 's3',
    name: 'Стрижка + Борода',
    description: 'Полный комплекс. Выгоднее вместе.',
  },
  {
    id: 's4',
    name: 'Детская Стрижка',
    description: 'Для юных джентльменов (до 12 лет).',
  },
  {
    id: 's5',
    name: 'Отец + Сын',
    description: 'Семейный визит. Две стрижки в одно время.',
  },
  {
    id: 's6',
    name: 'Камуфляж Седины',
    description: 'Тонирование головы или бороды. Эффект до 2 недель.',
  },
  {
    id: 's7',
    name: 'Королевское Бритье',
    description: 'Опасная бритва, распаривание, массаж.',
  },
];

export const BARBERS: Barber[] = [
  {
    id: 'b1',
    name: 'Алекс "Maverick"',
    tier: 'Top Barber',
    description: 'Виртуоз классики и удлиненных стрижек. Опыт 7 лет. Бренд-амбассадор барбер-культуры. Стрижет долго, дорого, идеально.',
    image: 'https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=800&auto=format&fit=crop&q=60',
    rating: 5.0,
    tags: ['🗣️ Любит поболтать', '📸 Перфекционист', '☕ Кофеман'],
    workDays: [1, 3, 4, 5, 6], // Mon, Wed, Thu, Fri, Sat
    services: [
      { serviceId: 's1', price: 2500, durationMinutes: 60 },
      { serviceId: 's2', price: 1500, durationMinutes: 45 },
      { serviceId: 's3', price: 3500, durationMinutes: 90 },
      { serviceId: 's5', price: 4000, durationMinutes: 90 },
      { serviceId: 's7', price: 2500, durationMinutes: 60 },
    ]
  },
  {
    id: 'b2',
    name: 'Виктор "Viking"',
    tier: 'Beard Expert',
    description: 'Специалист по сложным бородам и брутальным образам. Знает о бритье всё. Если нужна идеальная геометрия бороды — вам к нему.',
    image: 'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?w=800&auto=format&fit=crop&q=60',
    rating: 4.9,
    tags: ['🪓 Брутал', '🤫 Спокойный', '🧔 Борода'],
    workDays: [2, 4, 5, 6, 0], // Tue, Thu, Fri, Sat, Sun
    services: [
      { serviceId: 's1', price: 2000, durationMinutes: 45 },
      { serviceId: 's2', price: 1800, durationMinutes: 45 }, 
      { serviceId: 's3', price: 3200, durationMinutes: 90 },
      { serviceId: 's6', price: 1200, durationMinutes: 30 },
      { serviceId: 's7', price: 2200, durationMinutes: 60 },
    ]
  },
  {
    id: 'b3',
    name: 'Костя "Fade"',
    tier: 'Senior Barber',
    description: 'Мастер коротких форм. Фейд любой сложности, Кроп, Цезарь. Быстрота и точность движений. Опыт 5 лет.',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&auto=format&fit=crop&q=60',
    rating: 4.8,
    tags: ['⚽ Футбол', '🎮 Геймер', '🔥 Смелые стрижки'],
    workDays: [1, 2, 3, 4, 5], // Mon-Fri
    services: [
      { serviceId: 's1', price: 1800, durationMinutes: 45 },
      { serviceId: 's2', price: 1200, durationMinutes: 30 },
      { serviceId: 's3', price: 2600, durationMinutes: 75 },
      { serviceId: 's4', price: 1400, durationMinutes: 45 },
      { serviceId: 's5', price: 3000, durationMinutes: 75 },
    ]
  },
  {
    id: 'b4',
    name: 'Дмитрий',
    tier: 'Middle Barber',
    description: 'Универсал с уклоном в уличный стиль. Отлично работает с текстурой. Внимателен к пожеланиям клиента. Опыт 3 года.',
    image: 'https://images.unsplash.com/photo-1503443207922-dff7d543fd0e?w=800&auto=format&fit=crop&q=60',
    rating: 4.7,
    tags: ['🎧 Музыка', '🛹 Стритвир', '👂 Слушатель'],
    workDays: [3, 4, 5, 6, 0], // Wed-Sun
    services: [
      { serviceId: 's1', price: 1500, durationMinutes: 60 },
      { serviceId: 's2', price: 1000, durationMinutes: 45 },
      { serviceId: 's3', price: 2200, durationMinutes: 90 },
      { serviceId: 's4', price: 1200, durationMinutes: 45 },
      { serviceId: 's6', price: 1000, durationMinutes: 30 },
    ]
  },
  {
    id: 'b5',
    name: 'Макс',
    tier: 'Junior Barber',
    description: 'Молодой талант. Работает медленнее топов, но с запредельной старательностью. Проходит обучение у старших мастеров.',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=60',
    rating: 4.5,
    tags: ['🐢 Старательный', '👶 Молодой', '🎓 Ученик'],
    workDays: [1, 2, 3, 4, 5, 6, 0], // Everyday grinder
    services: [
      { serviceId: 's1', price: 1000, durationMinutes: 75 },
      { serviceId: 's2', price: 800, durationMinutes: 60 },
      { serviceId: 's3', price: 1600, durationMinutes: 120 },
      { serviceId: 's4', price: 900, durationMinutes: 60 },
    ]
  },
  {
    id: 'b6',
    name: 'Сергей Палыч',
    tier: 'Old School',
    description: 'Легенда заведения. Только классика, только ножницы, только хардкор. Опыт более 15 лет. Молчалив и сосредоточен.',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=60',
    rating: 5.0,
    tags: ['🗿 Молчун', '⚡ Быстро', '🥃 Классика'],
    workDays: [5, 6, 0], // Fri, Sat, Sun only
    services: [
      { serviceId: 's1', price: 2000, durationMinutes: 45 },
      { serviceId: 's7', price: 2500, durationMinutes: 60 }, 
      { serviceId: 's5', price: 3500, durationMinutes: 75 },
    ]
  },
];
