export const CATEGORY_META = {
  Batsman: { chip: 'chip-batsman', avatar: 'avatar-batsman', icon: '🏏' },
  Bowler: { chip: 'chip-bowler', avatar: 'avatar-bowler', icon: '🎯' },
  'All Rounder': { chip: 'chip-all-rounder', avatar: 'avatar-all-rounder', icon: '⭐' }
};

export const getCategoryMeta = (category) => CATEGORY_META[category] || CATEGORY_META.Batsman;

export const getInitials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

export const formatCurrency = (value) => `₹${new Intl.NumberFormat('en-IN').format(Number(value) || 0)}`;
