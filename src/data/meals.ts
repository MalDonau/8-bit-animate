import { nanoid } from 'nanoid';

export type MealType = 'almuerzo' | 'cena';

export type Dish = {
  id: string;
  name: string;
  protein: string;
  mealTypes: MealType[];
  notes: string;
};

export type WeeklySlot = {
  day: string;
  mealType: MealType;
};

export type PlannedMeal = WeeklySlot & {
  dish: Dish | null;
};

export const weeklySlots: WeeklySlot[] = [
  { day: 'Lunes', mealType: 'almuerzo' },
  { day: 'Lunes', mealType: 'cena' },
  { day: 'Martes', mealType: 'almuerzo' },
  { day: 'Martes', mealType: 'cena' },
  { day: 'Miercoles', mealType: 'almuerzo' },
  { day: 'Miercoles', mealType: 'cena' },
  { day: 'Jueves', mealType: 'almuerzo' },
  { day: 'Jueves', mealType: 'cena' },
  { day: 'Viernes', mealType: 'almuerzo' },
  { day: 'Viernes', mealType: 'cena' },
];

export const sampleDishes: Dish[] = [
  {
    id: nanoid(),
    name: 'Milanesas con pure',
    protein: 'carne vacuna',
    mealTypes: ['almuerzo', 'cena'],
    notes: 'Ideal cuando queres cocinar una sola vez y repetir guarnicion.',
  },
  {
    id: nanoid(),
    name: 'Pollo al horno con papas',
    protein: 'pollo',
    mealTypes: ['almuerzo', 'cena'],
    notes: '',
  },
  {
    id: nanoid(),
    name: 'Tacos de cerdo',
    protein: 'cerdo',
    mealTypes: ['cena'],
    notes: 'Mejor para una cena rapida con mise en place lista.',
  },
  {
    id: nanoid(),
    name: 'Salmon con arroz y brocoli',
    protein: 'salmon',
    mealTypes: ['cena'],
    notes: '',
  },
  {
    id: nanoid(),
    name: 'Tarta de atun',
    protein: 'atun',
    mealTypes: ['almuerzo', 'cena'],
    notes: '',
  },
  {
    id: nanoid(),
    name: 'Lentejas guisadas',
    protein: 'lentejas',
    mealTypes: ['almuerzo'],
    notes: 'Plato rendidor para batch cooking.',
  },
  {
    id: nanoid(),
    name: 'Tortilla de papa',
    protein: 'huevo',
    mealTypes: ['cena'],
    notes: '',
  },
  {
    id: nanoid(),
    name: 'Curry de garbanzos',
    protein: 'garbanzos',
    mealTypes: ['almuerzo', 'cena'],
    notes: '',
  },
  {
    id: nanoid(),
    name: 'Pasta con boloñesa',
    protein: 'carne picada',
    mealTypes: ['almuerzo'],
    notes: '',
  },
  {
    id: nanoid(),
    name: 'Fajitas de pavo',
    protein: 'pavo',
    mealTypes: ['cena'],
    notes: '',
  },
  {
    id: nanoid(),
    name: 'Wok de tofu y vegetales',
    protein: 'tofu',
    mealTypes: ['almuerzo', 'cena'],
    notes: '',
  },
  {
    id: nanoid(),
    name: 'Burritos de porotos negros',
    protein: 'porotos negros',
    mealTypes: ['almuerzo'],
    notes: '',
  },
];
