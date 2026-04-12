"use client";

import { useState, useEffect } from 'react';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './questionnaire-management.module.scss';

export default function QuestionnaireManagementPage() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStyle, setSelectedStyle] = useState(null);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        fetchQuestionnaireData();
    }, []);

    const fetchQuestionnaireData = async () => {
        try {
            setIsLoading(true);
            const response = await fetchWithAuth('/api/admin/questionnaire');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    setData(result.data);
                    // בחירת הסגנון הראשון כברירת מחדל
                    if (result.data.styles && result.data.styles.length > 0) {
                        setSelectedStyle(result.data.styles[0].name);
                    }
                }
            } else {
                setErrorMessage('שגיאה בטעינת הנתונים');
            }
        } catch (error) {
            console.error('Error fetching questionnaire data:', error);
            setErrorMessage('שגיאה בטעינת הנתונים');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditQuestion = (question) => {
        setEditingQuestion({
            ...question,
            newWording: question.currentWording.wording,
            newYesText: question.currentWording.yesText,
            newMaybeText: question.currentWording.maybeText,
            newNoText: question.currentWording.noText
        });
    };

    const handleSaveEdit = async () => {
        if (!editingQuestion) return;

        // בדיקה אם יש שינוי אמיתי
        const currentWording = editingQuestion.currentWording;
        const hasChanges = 
            editingQuestion.newWording !== currentWording.wording ||
            editingQuestion.newYesText !== currentWording.yesText ||
            editingQuestion.newMaybeText !== currentWording.maybeText ||
            editingQuestion.newNoText !== currentWording.noText;

        if (!hasChanges) {
            setErrorMessage('לא בוצעו שינויים בשאלה');
            setTimeout(() => setErrorMessage(''), 3000);
            setEditingQuestion(null);
            return;
        }

        try {
            const response = await fetchWithAuth('/api/admin/questionnaire', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    questionId: editingQuestion.id,
                    newWording: {
                        wording: editingQuestion.newWording,
                        yesText: editingQuestion.newYesText,
                        maybeText: editingQuestion.newMaybeText,
                        noText: editingQuestion.newNoText
                    }
                })
            });

            const result = await response.json();
            
            if (result.success) {
                setSuccessMessage('נוסח חדש נוצר בהצלחה!');
                setEditingQuestion(null);
                fetchQuestionnaireData(); // רענון הנתונים
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setErrorMessage(result.error?.message || 'שגיאה בשמירת הנתונים');
                setTimeout(() => setErrorMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error saving question:', error);
            setErrorMessage('שגיאה בשמירת הנתונים');
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };

    const handleCancelEdit = () => {
        setEditingQuestion(null);
    };

    const handleEditCategory = (category) => {
        setEditingCategory({
            id: category.id,
            name: category.name,
            weight: parseFloat(category.weight)
        });
    };

    const handleSaveCategoryWeight = async () => {
        if (!editingCategory) return;

        try {
            const response = await fetchWithAuth('/api/admin/questionnaire', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    categoryId: editingCategory.id,
                    weight: editingCategory.weight
                })
            });

            const result = await response.json();
            
            if (result.success) {
                setSuccessMessage('משקל הקטגוריה עודכן בהצלחה!');
                setEditingCategory(null);
                fetchQuestionnaireData(); // רענון הנתונים
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setErrorMessage(result.error?.message || 'שגיאה בשמירת המשקל');
                setTimeout(() => setErrorMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error saving category weight:', error);
            setErrorMessage('שגיאה בשמירת המשקל');
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };

    const handleCancelCategoryEdit = () => {
        setEditingCategory(null);
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>טוען...</div>
            </div>
        );
    }

    const currentStyleData = selectedStyle && data?.questionsByStyle[selectedStyle];

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h1>ניהול שאלון</h1>
                    <p>ניהול שאלות ותשובות לכל סגנוני השאלון</p>
                </div>
            </div>

            {successMessage && (
                <div className={styles.successMessage}>
                    {successMessage}
                </div>
            )}

            {errorMessage && (
                <div className={styles.errorMessage}>
                    {errorMessage}
                </div>
            )}

            <div className={styles.content}>
                {/* בחירת סגנון */}
                <div className={styles.styleSelector}>
                    <h3>בחר סגנון שאלון:</h3>
                    <div className={styles.styleTabs}>
                        {data?.styles.map(style => (
                            <button
                                key={style.id}
                                className={`${styles.styleTab} ${selectedStyle === style.name ? styles.active : ''}`}
                                onClick={() => setSelectedStyle(style.name)}
                            >
                                {style.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* רשימת קטגוריות */}
                <div className={styles.categoriesInfo}>
                    <h3>קטגוריות ומשקלים:</h3>
                    <div className={styles.categoriesList}>
                        {data?.categories.map(cat => (
                            <div key={cat.id} className={styles.categoryItem}>
                                {editingCategory?.id === cat.id ? (
                                    // מצב עריכה
                                    <div className={styles.categoryEditMode}>
                                        <div className={styles.categoryName}>{cat.name}</div>
                                        <div className={styles.weightEdit}>
                                            <label>משקל:</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={editingCategory.weight}
                                                onChange={(e) => setEditingCategory({
                                                    ...editingCategory,
                                                    weight: parseFloat(e.target.value)
                                                })}
                                            />
                                        </div>
                                        <div className={styles.categoryActions}>
                                            <button 
                                                className={styles.saveCategoryButton}
                                                onClick={handleSaveCategoryWeight}
                                            >
                                                ✓
                                            </button>
                                            <button 
                                                className={styles.cancelCategoryButton}
                                                onClick={handleCancelCategoryEdit}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // מצב תצוגה
                                    <>
                                        <span className={styles.categoryName}>{cat.name}</span>
                                        <span className={styles.categoryWeight}>משקל: {parseFloat(cat.weight).toFixed(2)}</span>
                                        <button 
                                            className={styles.editCategoryButton}
                                            onClick={() => handleEditCategory(cat)}
                                            title="ערוך משקל"
                                        >
                                            ✎
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className={styles.categoryNote}>
                        <strong>שימו לב:</strong> סכום כל המשקלים צריך להיות 1.00
                    </div>
                </div>

                {/* שאלות לסגנון הנבחר */}
                {currentStyleData && (
                    <div className={styles.questionsSection}>
                        <h2>שאלות - {currentStyleData.styleName}</h2>
                        <div className={styles.questionsList}>
                            {currentStyleData.questions.map(question => (
                                <div key={question.id} className={styles.questionCard}>
                                    <div className={styles.questionHeader}>
                                        <div className={styles.questionNumber}>
                                            שאלה {question.number}
                                        </div>
                                        <div className={styles.questionCategories}>
                                            קטגוריות: {question.categories.join(', ')}
                                        </div>
                                    </div>

                                    {editingQuestion?.id === question.id ? (
                                        // מצב עריכה
                                        <div className={styles.editMode}>
                                            <div className={styles.formGroup}>
                                                <label>נוסח השאלה:</label>
                                                <textarea
                                                    value={editingQuestion.newWording}
                                                    onChange={(e) => setEditingQuestion({
                                                        ...editingQuestion,
                                                        newWording: e.target.value
                                                    })}
                                                    rows={3}
                                                />
                                            </div>

                                            <div className={styles.answersEdit}>
                                                <h4>תשובות:</h4>
                                                <div className={styles.formGroup}>
                                                    <label>תשובה 1 (כן):</label>
                                                    <input
                                                        type="text"
                                                        value={editingQuestion.newYesText}
                                                        onChange={(e) => setEditingQuestion({
                                                            ...editingQuestion,
                                                            newYesText: e.target.value
                                                        })}
                                                    />
                                                </div>
                                                <div className={styles.formGroup}>
                                                    <label>תשובה 2 (תלוי):</label>
                                                    <input
                                                        type="text"
                                                        value={editingQuestion.newMaybeText}
                                                        onChange={(e) => setEditingQuestion({
                                                            ...editingQuestion,
                                                            newMaybeText: e.target.value
                                                        })}
                                                    />
                                                </div>
                                                <div className={styles.formGroup}>
                                                    <label>תשובה 3 (לא):</label>
                                                    <input
                                                        type="text"
                                                        value={editingQuestion.newNoText}
                                                        onChange={(e) => setEditingQuestion({
                                                            ...editingQuestion,
                                                            newNoText: e.target.value
                                                        })}
                                                    />
                                                </div>
                                            </div>

                                            <div className={styles.editActions}>
                                                <button 
                                                    className={styles.saveButton}
                                                    onClick={handleSaveEdit}
                                                >
                                                    שמור (יצירת נוסח חדש)
                                                </button>
                                                <button 
                                                    className={styles.cancelButton}
                                                    onClick={handleCancelEdit}
                                                >
                                                    ביטול
                                                </button>
                                            </div>

                                            <div className={styles.noteMessage}>
                                                <strong>שימו לב:</strong> השמירה תיצור נוסח חדש ולא תערוך את הקיים
                                            </div>
                                        </div>
                                    ) : (
                                        // מצב תצוגה
                                        <div className={styles.viewMode}>
                                            <div className={styles.questionContent}>
                                                <h4>נוסח השאלה:</h4>
                                                <p>{question.currentWording?.wording || 'אין נוסח זמין'}</p>
                                            </div>

                                            {question.currentWording && (
                                                <div className={styles.answers}>
                                                    <h4>תשובות:</h4>
                                                    <div className={styles.answerItem}>
                                                        <span className={styles.answerLabel}>כן:</span>
                                                        <span>{question.currentWording.yesText}</span>
                                                    </div>
                                                    <div className={styles.answerItem}>
                                                        <span className={styles.answerLabel}>תלוי:</span>
                                                        <span>{question.currentWording.maybeText}</span>
                                                    </div>
                                                    <div className={styles.answerItem}>
                                                        <span className={styles.answerLabel}>לא:</span>
                                                        <span>{question.currentWording.noText}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className={styles.questionActions}>
                                                <button 
                                                    className={styles.editButton}
                                                    onClick={() => handleEditQuestion(question)}
                                                >
                                                    ערוך שאלה
                                                </button>
                                            </div>

                                            {question.allWordings.length > 1 && (
                                                <div className={styles.wordingsHistory}>
                                                    <details>
                                                        <summary>היסטוריית נוסחים ({question.allWordings.length})</summary>
                                                        <div className={styles.historyList}>
                                                            {question.allWordings.map((w, index) => (
                                                                <div key={w.id} className={styles.historyItem}>
                                                                    <div className={styles.historyHeader}>
                                                                        <strong>נוסח {index + 1}</strong>
                                                                        <span className={styles.historyDate}>
                                                                            {new Date(w.createdAt).toLocaleDateString('he-IL')}
                                                                        </span>
                                                                    </div>
                                                                    <div className={styles.historyContent}>
                                                                        <p><strong>שאלה:</strong> {w.wording}</p>
                                                                        <div className={styles.historyAnswers}>
                                                                            <div className={styles.historyAnswerItem}>
                                                                                <span className={styles.answerLabel}>כן:</span>
                                                                                <span>{w.yesText}</span>
                                                                            </div>
                                                                            <div className={styles.historyAnswerItem}>
                                                                                <span className={styles.answerLabel}>תלוי:</span>
                                                                                <span>{w.maybeText}</span>
                                                                            </div>
                                                                            <div className={styles.historyAnswerItem}>
                                                                                <span className={styles.answerLabel}>לא:</span>
                                                                                <span>{w.noText}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </details>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

