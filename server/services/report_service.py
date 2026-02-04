from fpdf import FPDF
import tempfile
import os
from models import EvaluationResult, EvaluationDetail

class PDFReport(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Assignment Evaluation Report', 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, 'Page ' + str(self.page_no()) + '/{nb}', 0, 0, 'C')

class ReportService:
    def clean_text(self, text: str) -> str:
        """Sanitize text to be compatible with FPDF (Latin-1)"""
        if not text:
            return ""
        # Replace common incompatible characters
        replacements = {
            '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"',
            '\u2013': '-', '\u2014': '--', '\u2022': '*', '\u2026': '...'
        }
        for k, v in replacements.items():
            text = text.replace(k, v)
            
        # Fallback for other characters
        return text.encode('latin-1', 'replace').decode('latin-1')

    def generate_pdf_report(self, result: EvaluationResult, details: list[EvaluationDetail]) -> str:
        pdf = PDFReport()
        pdf.alias_nb_pages()
        pdf.add_page()
        pdf.set_font('Arial', '', 12)

        # Title Area
        pdf.set_font('Arial', 'B', 16)
        pdf.cell(0, 10, 'Assignment Evaluation Report', 0, 1, 'C')
        pdf.ln(10)

        # Student Info Table-like structure
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(40, 10, 'Student Name:', 0)
        pdf.set_font('Arial', '', 12)
        pdf.cell(0, 10, self.clean_text(result.student_name), 0, 1)

        # Hide Score for GitHub
        if result.evaluation_type != "github":
            pdf.set_font('Arial', 'B', 12)
            pdf.cell(40, 10, 'Score:', 0)
            # Color score
            if result.score_percent >= 80:
                pdf.set_text_color(0, 100, 0) # Green
            elif result.score_percent >= 50:
                pdf.set_text_color(255, 140, 0) # Orange
            else:
                pdf.set_text_color(200, 0, 0) # Red
            pdf.set_font('Arial', 'B', 12)
            pdf.cell(0, 10, f"{result.score_percent}%", 0, 1)
            pdf.set_text_color(0, 0, 0) # Reset
        
        pdf.ln(5)

        # Summary Section
        if result.reasoning:
            pdf.set_fill_color(240, 240, 240)
            pdf.set_font('Arial', 'B', 12)
            # Change label for GitHub
            label = "Repository Analysis:" if result.evaluation_type == "github" else "Overall Feedback / Reasoning:"
            pdf.cell(0, 8, label, 0, 1, 'L', 1)
            pdf.set_font('Arial', '', 11)
            pdf.multi_cell(0, 6, self.clean_text(result.reasoning))
            pdf.ln(5)
            
        if result.summary and result.evaluation_type != "github":
            pdf.set_fill_color(240, 240, 240)
            pdf.set_font('Arial', 'B', 12)
            pdf.cell(0, 8, 'Summary:', 0, 1, 'L', 1)
            pdf.set_font('Arial', '', 11)
            pdf.multi_cell(0, 6, self.clean_text(result.summary))
            pdf.ln(5)

        # Details Section
        if details:
            pdf.ln(5)
            pdf.set_font('Arial', 'B', 14)
            label_details = "Analysis Details" if result.evaluation_type == "github" else "Detailed Question Analysis"
            pdf.cell(0, 10, label_details, 0, 1, 'L')
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(5)

            for idx, detail in enumerate(details, 1):
                # Check for page break if close to bottom
                if pdf.get_y() > 250:
                    pdf.add_page()
                
                # Question Header
                pdf.set_font('Arial', 'B', 11)
                pdf.set_fill_color(245, 247, 250)
                q_label = f"Q{idx}. {detail.question}" if result.evaluation_type != "github" else detail.question
                pdf.multi_cell(0, 8, self.clean_text(q_label), 1, 'L', 1)
                
                # Answers Block
                pdf.set_font('Arial', 'B', 10)
                ans_label = 'Answer:' if result.evaluation_type == "github" else 'Student Answer:'
                pdf.cell(40, 6, ans_label, 0)
                pdf.set_font('Arial', '', 10)
                pdf.multi_cell(0, 6, self.clean_text(detail.student_answer))
                
                if detail.correct_answer and result.evaluation_type != "github":
                    pdf.set_font('Arial', 'B', 10)
                    pdf.cell(40, 6, 'Correct Answer:', 0)
                    pdf.set_font('Arial', 'I', 10)
                    pdf.set_text_color(80, 80, 80)
                    pdf.multi_cell(0, 6, self.clean_text(detail.correct_answer))
                    pdf.set_text_color(0, 0, 0)

                # Status and Feedback
                # Hide Status for GitHub
                if result.evaluation_type != "github":
                    pdf.ln(2)
                    
                    # Determine status label and color
                    if detail.is_correct:
                        status_label = "Correct"
                        color = (0, 128, 0) # Green
                    elif detail.partial_credit and detail.partial_credit > 0:
                        status_label = f"Partially Correct ({int(detail.partial_credit * 100)}%)"
                        color = (255, 140, 0) # Orange
                    else:
                        status_label = "Incorrect"
                        color = (200, 0, 0) # Red
                    
                    pdf.set_font('Arial', 'B', 10)
                    pdf.write(5, "Status: ")
                    
                    pdf.set_text_color(*color)
                    pdf.set_font('Arial', 'B', 10)
                    pdf.write(5, status_label)
                    pdf.set_text_color(0, 0, 0)
                    pdf.ln(6)
                else:
                    pdf.ln(2)
                
                if detail.feedback:
                    pdf.set_font('Arial', 'B', 10)
                    pdf.write(5, "Analysis: " if result.evaluation_type == "github" else "Feedback: ")
                    pdf.set_font('Arial', '', 10)
                    pdf.multi_cell(0, 5, self.clean_text(detail.feedback))
                
                pdf.ln(8)


        # Save to temp file
        temp_dir = tempfile.gettempdir()
        filename = f"report_{result.id}_{result.student_name}.pdf".replace(" ", "_")
        filepath = os.path.join(temp_dir, filename)
        pdf.output(filepath, 'F')
        
        return filepath
