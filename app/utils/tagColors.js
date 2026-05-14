const TAG_COLORS = [
  { bg: '#DAEAFE', text: '#0C4AD5' },
  { bg: '#F3F5F7', text: '#454B4E' },
  { bg: '#ECE9FC', text: '#744ABF' },
  { bg: '#FDE4E3', text: '#B35056' },
  { bg: 'rgba(50, 255, 255, 0.2)', text: '#26A9A9' },
  { bg: '#FBE7F3', text: '#CC7093' },
];

export function getTagColor(tagId) {
  const idx = (typeof tagId === 'number' ? tagId : parseInt(tagId) || 0) % TAG_COLORS.length;
  return TAG_COLORS[idx];
}
