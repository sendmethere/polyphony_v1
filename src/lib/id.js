// 세션 코드 / 엔티티 ID 생성 유틸

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 헷갈리는 0/O/1/I 제외

export function makeSessionCode(len = 4) {
  let out = ''
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[arr[i] % CODE_ALPHABET.length]
  return out
}

export function makeId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}
