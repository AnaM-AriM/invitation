import photos from "./photos.json";

export interface WeddingConfig {
  isExample: boolean;
  couple: [{ name: string; parents: string; phone?: string }, { name: string; parents: string; phone?: string }];
  dateTime: string; endDateTime: string;
  venue: { name: string; hall: string; address: string; phone?: string; kakaoPlaceId?: string; transit: string[] };
  invitation: string[];
  photos: { src: string; alt: string }[];
  coverPhoto?: { src: string; alt: string };
  accounts: { label: string; bank: string; number: string; holder: string }[];
  guestbookUrl: string;
}
// Personal phone numbers, parents and hall remain empty until confirmed.
// Public assets: put photos under public/photos and use /photos/your-file.webp.
export const wedding: WeddingConfig = {
  isExample: false,
  couple: [{ name: "권아남", parents: "" }, { name: "유아림", parents: "" }],
  dateTime: "2027-03-13T14:00:00+09:00", endDateTime: "2027-03-13T15:00:00+09:00",
  venue: { name: "전주 그랜드힐스턴", hall: "", address: "전북특별자치도 전주시 완산구 서곡5길 22-5", phone: "063-251-8000", kakaoPlaceId: "1924220244", transit: [] },
  invitation: ["서로의 계절이 되어 줄 두 사람이", "이제 같은 길을 걸으려 합니다.", "소중한 발걸음으로 자리를 빛내 주시면", "그 마음 오래 간직하며 살겠습니다."],
  photos, coverPhoto: photos[0], accounts: [], guestbookUrl: "",
};
