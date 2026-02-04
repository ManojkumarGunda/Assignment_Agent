import difflib
from typing import List, Dict

class PlagiarismService:
    @staticmethod
    def calculate_similarity(text1: str, text2: str) -> float:
        """Calculate the similarity ratio between two strings."""
        if not text1 or not text2:
            return 0.0
        # Normalize text: lower case and strip whitespace
        t1 = text1.lower().strip()
        t2 = text2.lower().strip()
        
        # Using SequenceMatcher for a robust comparison
        return difflib.SequenceMatcher(None, t1, t2).ratio()

    def check_batch_plagiarism(self, evaluation_results: List[Dict]) -> List[Dict]:
        """
        Compares each student's answers against every other student in the current batch.
        Updates the evaluation_results list with 'plagiarism' metadata.
        """
        threshold = 0.80  # 80% similarity threshold
        
        # Iterate through each student in the batch
        for i in range(len(evaluation_results)):
            student_i = evaluation_results[i]
            student_i['plagiarism_alerts'] = []
            
            # Compare against every other student j
            for j in range(len(evaluation_results)):
                if i == j:
                    continue
                
                student_j = evaluation_results[j]
                
                # Compare per-question details
                shared_content_found = False
                matches = []
                
                # Match questions between student i and student j
                details_i = student_i.get('details', [])
                details_j = student_j.get('details', [])
                
                for q_idx in range(min(len(details_i), len(details_j))):
                    ans_i = details_i[q_idx].get('student_answer', '') or details_i[q_idx].get('answer', '')
                    ans_j = details_j[q_idx].get('student_answer', '') or details_j[q_idx].get('answer', '')
                    
                    # Ignore very short answers (less than 10 chars)
                    if len(ans_i) < 10 or len(ans_j) < 10:
                        continue
                        
                    similarity = self.calculate_similarity(ans_i, ans_j)
                    
                    if similarity >= threshold:
                        matches.append({
                            "question_index": q_idx + 1,
                            "similarity": round(similarity * 100, 1),
                            "target_student": student_j.get('name', f"Student {j+1}")
                        })
                        shared_content_found = True
                
                if shared_content_found:
                    # Record the highest match for this specific pair
                    max_sim = max([m['similarity'] for m in matches])
                    student_i['plagiarism_alerts'].append({
                        "student_name": student_j.get('name', f"Student {j+1}"),
                        "max_similarity": max_sim,
                        "flagged_questions": [m['question_index'] for m in matches]
                    })
            
            # Final top-level flag for UI
            student_i['is_plagiarized'] = len(student_i['plagiarism_alerts']) > 0
            
        return evaluation_results
