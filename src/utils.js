export function normalizeQuery(q) {
  const clean = q.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /\bkaraoke\b/i.test(clean) ? clean : `${clean} karaoke`;
}

export function removeVietnameseAccents(str) {
  const accents = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ';
  const noAccents = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD';
  return str.split('').map(char => {
    const index = accents.indexOf(char);
    return index !== -1 ? noAccents[index] : char;
  }).join('').toLowerCase();
}

export function formatViewCount(count) {
  if (!count) return '';
  const num = parseInt(count);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}
