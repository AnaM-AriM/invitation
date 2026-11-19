import photos from "./photos.json";

export interface WeddingConfig {
  isExample: boolean;
  couple: [{ name: string; parents: string; phone?: string }, { name: string; parents: string; phone?: string }];
  dateTime: string; endDateTime: string;
  venue: { name: string; hall: string; address: string; transit: string[] };
  invitation: string[];
  photos: { src: string; alt: string }[];
  coverPhoto?: { src: string; alt: string };
  accounts: { label: string; bank: string; number: string; holder: string }[];
  guestbookUrl: string;
}
// All personal details below are EXAMPLES. Replace them, then set isExample:false.
// Public assets: put photos under public/photos and use /photos/your-file.webp.
export const wedding: WeddingConfig = {
  isExample: true,
  couple: [{ name: "김하늘", parents: "김○○ · 이○○의 아들" }, { name: "이봄", parents: "이○○ · 박○○의 딸" }],
  dateTime: "2027-05-22T14:00:00+09:00", endDateTime: "2027-05-22T15:00:00+09:00",
  venue: { name: "예식장 이름", hall: "홀 이름을 입력해 주세요", address: "", transit: [] },
  invitation: ["서로의 계절이 되어 줄 두 사람이", "이제 같은 길을 걸으려 합니다.", "소중한 발걸음으로 자리를 빛내 주시면", "그 마음 오래 간직하며 살겠습니다."],
  photos, coverPhoto: photos[0], accounts: [], guestbookUrl: "",
};
