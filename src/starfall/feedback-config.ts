// 玩家回報問題用的 Google 表單。兩個都留空 = 還沒設定：遊戲裡的「回報問題」只提供複製。
// form：表單的填寫網址，https://docs.google.com/forms/d/e/…/viewform
// entry：收診斷資訊的那一題的編號。在表單的「取得預先填入的連結」隨便填幾個字產生網址，
//        網址裡 entry.1234567890=… 的那串數字就是它。
//
// 現在這份是「星墜殘響 問題回報」（2026-11-25 建立）：三題，發生了什麼事（必填）、診斷資訊、手機或平板的型號（選填）。
// 不收集電子郵件、不限回覆次數，填的人不用登入。
export const FEEDBACK = {
  form: 'https://docs.google.com/forms/d/e/1FAIpQLSd6gGeyuQlyPykgDlFhzDpxGzpLJHl51QGE7o0hK4NjjvYKnA/viewform',
  entry: '2063113410',
};
