
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

export const BLOCK_TYPES = {
  LUNCH: { id: 'block_lunch', name: 'ОБЕД', duration: 60 },
  DAY_OFF: { id: 'block_day_off', name: 'ВЫХОДНОЙ', duration: 660 }, // 11 hours (10:00 - 21:00)
  EARLY: { id: 'block_early', name: 'УШЕЛ РАНЬШЕ', duration: 0 }, // Calc dynamically
  CUSTOM: { id: 'block_custom', name: 'ТЕХ. ПЕРЕРЫВ', duration: 30 }
};

export const BARBERS: Barber[] = [
  {
    id: 'b1',
    name: 'Алекс "Maverick"',
    tier: 'Top Barber',
    description: 'Виртуоз классики и удлиненных стрижек. Опыт 7 лет. Бренд-амбассадор барбер-культуры. Стрижет долго, дорого, идеально.',
    // Stylish, confident, suit/coat
    image: 'https://i.pinimg.com/736x/76/02/bd/7602bdc241afa97a3aca511420dc1c6d.jpg',
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
    // Brutal, heavy beard, tattoos
    image: 'https://i.pinimg.com/736x/4d/07/6e/4d076e0dd826ede7dd619d7fd004b67f.jpg', 
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
    // Fade expert, Black barber
    image: 'https://i.pinimg.com/736x/93/e5/d4/93e5d48dd43aa8e73f3bfb078a3f5fbe.jpg',
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
    // Middle, street style, beanie/cap
    image: 'https://i.pinimg.com/736x/c1/36/6d/c1366d39b6756b7f3f5e6d519502039d.jpg',
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
    // Junior, Young
    image: 'https://i.pinimg.com/736x/aa/ee/91/aaee910ede5a733ac29b39c454cab8b1.jpg',
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
    description: 'Легенда заведения. Опыт более 20 лет. Мастер старой закалки. Не любит разговоры, делает свою работу идеально.',
    // Old School, Older
    image: 'https://i.pinimg.com/736x/67/8f/73/678f737e830170b1b26cc708442e3808.jpg',
    rating: 5.0,
    tags: ['🥃 Олдскул', '🤐 Молчун', '✂️ Только ножницы'],
    workDays: [5, 6, 0],
    services: [
      { serviceId: 's1', price: 3000, durationMinutes: 60 },
      { serviceId: 's2', price: 2000, durationMinutes: 45 },
      { serviceId: 's3', price: 4500, durationMinutes: 90 },
      { serviceId: 's7', price: 3000, durationMinutes: 60 },
    ]
  },
];
