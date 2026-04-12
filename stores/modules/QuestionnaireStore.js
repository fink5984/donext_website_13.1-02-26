"use client";
import { makeAutoObservable, runInAction } from "mobx";
import fetchWithAuth from "../../app/utils/fetchWithAuth";

class QuestionnaireStore {
  styles = [];
  questionsByStyleId = {}; // { [styleId]: questions[] }
  isLoadingStyles = false;
  loadingQuestionsForStyle = {}; // { [styleId]: boolean }

  constructor(rootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
  }

  /**
   * שליפת כל סוגי השאלונים מהשרת (רק אם עדיין לא נטענו)
   */
  async fetchStyles() {
    // אם כבר נטענו, לא צריך לשלוף שוב
    if (this.styles.length > 0 || this.isLoadingStyles) {
      return this.styles;
    }

    this.isLoadingStyles = true;
    try {
      const response = await fetchWithAuth('/api/questionnaire/styles');
      const result = await response.json();
      
      if (result.success && result.data) {
        runInAction(() => {
          this.styles = result.data;
        });
        return result.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching questionnaire styles:', error);
      return [];
    } finally {
      runInAction(() => {
        this.isLoadingStyles = false;
      });
    }
  }

  /**
   * שליפת שאלות לפי סגנון ושפה
   */
  async fetchQuestionsForStyle(styleId, language = 'he') {
    if (!styleId) return [];

    const cacheKey = `${styleId}_${language}`;

    // אם כבר נטענו השאלות לסגנון ושפה זו, מחזירים אותן
    if (this.questionsByStyleId[cacheKey]) {
      return this.questionsByStyleId[cacheKey];
    }

    // אם כבר בתהליך טעינה, ממתינים לסיום
    if (this.loadingQuestionsForStyle[cacheKey]) {
      // מחכים עד שהטעינה תסתיים
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loadingQuestionsForStyle[cacheKey]) {
            clearInterval(checkInterval);
            resolve(this.questionsByStyleId[cacheKey] || []);
          }
        }, 100);
      });
    }

    runInAction(() => {
      this.loadingQuestionsForStyle[cacheKey] = true;
    });

    try {
      const response = await fetchWithAuth(`/api/questionnaire/questions?styleId=${styleId}&language=${language}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        
        const formattedQuestions = result.data.map((q, index) => ({
          id: q.id,
          questionId: q.questionId,
          wordingId: q.wordingId,
          number: q.number,
          text: q.questionText,
          options: [
            { text: q.yesText },
            { text: q.maybeText },
            { text: q.noText }
          ]
        }));

        runInAction(() => {
          this.questionsByStyleId[cacheKey] = formattedQuestions;
        });
        return formattedQuestions;
      } else {
        console.error('Failed to fetch questions:', result.error || 'Unknown error');
      }
      return [];
    } catch (error) {
      console.error('Error fetching questions for style:', error);
      return [];
    } finally {
      runInAction(() => {
        this.loadingQuestionsForStyle[cacheKey] = false;
      });
    }
  }

  /**
   * בדיקה אם שאלות בטעינה לסגנון ושפה
   */
  isLoadingQuestionsForStyle(styleId, language = 'he') {
    const cacheKey = `${styleId}_${language}`;
    return this.loadingQuestionsForStyle[cacheKey] || false;
  }

  /**
   * קבלת השאלות לסגנון ושפה (ללא קריאה לשרת)
   */
  getQuestionsForStyle(styleId, language = 'he') {
    const cacheKey = `${styleId}_${language}`;
    return this.questionsByStyleId[cacheKey] || [];
  }

  /**
   * ניקוי הקאש (למשל אם צריך לרענן)
   */
  clearCache() {
    this.styles = [];
    this.questionsByStyleId = {};
  }

  /**
   * ניקוי שאלות לסגנון ספציפי
   */
  clearQuestionsForStyle(styleId) {
    delete this.questionsByStyleId[styleId];
  }
}

export default QuestionnaireStore;

