import type { ProductFieldSchema } from '@/lib/businessEngine';

const YEARS = Array.from({ length: 37 }, (_, i) => String(2026 - i));

export const VEHICLE_MODELS: Record<string, string[]> = {
  Toyota: ['Corolla', 'Hilux', 'Land Cruiser', 'RAV4', 'Fortuner', 'Vitz', 'Camry', 'Hiace', 'Noah', 'Avanza', 'Other'],
  Nissan: ['X-Trail', 'Navara', 'Patrol', 'Note', 'Tiida', 'Murano', 'Other'],
  Suzuki: ['Swift', 'Vitara', 'Jimny', 'Alto', 'Ertiga', 'Other'],
  Mitsubishi: ['Pajero', 'L200', 'Outlander', 'Colt', 'Other'],
  Honda: ['CR-V', 'Fit', 'Civic', 'Accord', 'Other'],
  Mazda: ['CX-5', 'BT-50', 'Demio', 'Axela', 'Other'],
  Ford: ['Ranger', 'Everest', 'Focus', 'Other'],
  Isuzu: ['D-Max', 'NPR', 'FRR', 'Other'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'Sprinter', 'Other'],
  BMW: ['X3', 'X5', '3 Series', '5 Series', 'Other'],
  Volkswagen: ['Golf', 'Polo', 'Tiguan', 'Amarok', 'Other'],
  'Land Rover': ['Discovery', 'Range Rover', 'Defender', 'Other'],
  Other: ['Other'],
};

const PRESETS: Record<string, string[] | ((parent?: string) => string[])> = {
  years: YEARS,
  vehicle_makes: () => [...Object.keys(VEHICLE_MODELS), 'Other'],
  vehicle_models: (make) => VEHICLE_MODELS[make ?? ''] ?? ['Other'],
  part_positions: ['Front', 'Rear', 'Left', 'Right', 'Front Left', 'Front Right', 'Universal', 'Other'],
  hardware_materials: ['PVC', 'Steel', 'Copper', 'Aluminium', 'Iron', 'Cement', 'Wood', 'Plastic', 'Rubber', 'Glass', 'Ceramic', 'Other'],
  hardware_brands: ['Bosch', 'Makita', 'Stanley', 'Crown', 'Turtle', 'Generic', 'Other'],
  pipe_sizes: ['1/2"', '3/4"', '1"', '1 1/4"', '2"', '3"', 'Other'],
  dosage_forms: ['Tablets', 'Capsules', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Sachets', 'Other'],
  storage_conditions: ['Room Temp', 'Refrigerated', 'Frozen', 'Dry Place', 'Other'],
  pharma_manufacturers: ['Shelys', 'Zenufa', 'Kilimanjaro Pharma', 'Phillips', 'GSK', 'Pfizer', 'Sanofi', 'Generic', 'Other'],
  phone_brands: ['Samsung', 'Apple', 'Tecno', 'Infinix', 'Xiaomi', 'Huawei', 'Oppo', 'Vivo', 'Nokia', 'Other'],
  ram_sizes: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB', 'Other'],
  storage_sizes: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', 'Other'],
  fashion_sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40', 'Other'],
  fashion_colors: ['Black', 'White', 'Blue', 'Red', 'Green', 'Yellow', 'Brown', 'Grey', 'Pink', 'Multi', 'Other'],
  fashion_materials: ['Cotton', 'Polyester', 'Denim', 'Leather', 'Silk', 'Wool', 'Linen', 'Synthetic', 'Other'],
  agrovet_crops: ['Maize', 'Rice', 'Beans', 'Tomatoes', 'Onions', 'Coffee', 'Cotton', 'Vegetables', 'Other'],
  agrovet_animals: ['Cattle', 'Goats', 'Sheep', 'Poultry', 'Pigs', 'Dogs', 'Cats', 'Other'],
  beauty_brands: ["L'Oreal", 'Nivea', 'Dove', 'Garnier', 'Local Brand', 'Other'],
  furniture_materials: ['Wood', 'MDF', 'Metal', 'Leather', 'Fabric', 'Glass', 'Plastic', 'Other'],
  furniture_colors: ['Brown', 'Black', 'White', 'Grey', 'Beige', 'Walnut', 'Other'],
  supermarket_brands: ['Azam', 'Serengeti', 'Local Brand', 'Imported', 'Other'],
  weight_units: ['250g', '500g', '1kg', '2kg', '5kg', '10kg', '25kg', 'Other'],
  salon_durations: ['15', '30', '45', '60', '90', '120', '180'],
  restaurant_prep: ['5', '10', '15', '20', '30', '45', '60'],
};

export function resolveFieldOptions(
  field: ProductFieldSchema,
  parentValue?: string,
): string[] {
  if (field.options?.length) return field.options;
  if (!field.preset) return [];
  const preset = PRESETS[field.preset];
  if (!preset) return [];
  if (typeof preset === 'function') return preset(parentValue);
  return preset;
}

export function resolveFieldPlaceholder(field: ProductFieldSchema, isSw: boolean): string | undefined {
  if (isSw ? field.placeholder_sw : field.placeholder_en) {
    return isSw ? field.placeholder_sw : field.placeholder_en;
  }
  return isSw ? 'Chagua au andika...' : 'Select or type...';
}
