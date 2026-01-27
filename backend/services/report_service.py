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
    def generate_pdf_report(self, result: EvaluationResult, details: list[EvaluationDetail]) -> str:
        pdf = PDFReport()
        pdf.alias_nb_pages()
        pdf.add_page()
        pdf.set_font('Arial', '', 12)

        # Student Info
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(40, 10, 'Student Name:', 0)
        pdf.set_font('Arial', '', 12)
        pdf.cell(0, 10, result.student_name, 0, 1)

        pdf.set_font('Arial', 'B', 12)
        pdf.cell(40, 10, 'Score:', 0)
        pdf.set_font('Arial', '', 12)
        pdf.cell(0, 10, f"{result.score_percent}%", 0, 1)

        pdf.ln(5)

        # Summary
        if result.reasoning:
            pdf.set_font('Arial', 'B', 12)
            pdf.cell(0, 10, 'Overall Feedback / Reasoning:', 0, 1)
            pdf.set_font('Arial', '', 11)
            pdf.multi_cell(0, 7, result.reasoning)
            pdf.ln(5)
            
        if result.summary:
            pdf.set_font('Arial', 'B', 12)
            pdf.cell(0, 10, 'Summary:', 0, 1)
            pdf.set_font('Arial', '', 11)
            pdf.multi_cell(0, 7, result.summary)
            pdf.ln(5)

        # Details
        if details:
            pdf.add_page()
            pdf.set_font('Arial', 'B', 14)
            pdf.cell(0, 10, 'Detailed Evaluation', 0, 1, 'L')
            pdf.ln(5)

            for idx, detail in enumerate(details, 1):
                # Question
                pdf.set_font('Arial', 'B', 11)
                pdf.multi_cell(0, 7, f"Q{idx}: {detail.question}")
                
                # Answer
                pdf.set_font('Arial', 'I', 11)
                pdf.multi_cell(0, 7, f"Student Answer: {detail.student_answer}")
                
                # Feedback
                pdf.set_font('Arial', '', 11)
                status = "Correct" if detail.is_correct else "Incorrect"
                pdf.multi_cell(0, 7, f"Status: {status}")
                pdf.multi_cell(0, 7, f"Feedback: {detail.feedback}")
                
                pdf.ln(5)
                # Separator
                pdf.line(10, pdf.get_y(), 200, pdf.get_y())
                pdf.ln(5)

        # Save to temp file
        temp_dir = tempfile.gettempdir()
        filename = f"report_{result.id}_{result.student_name}.pdf".replace(" ", "_")
        filepath = os.path.join(temp_dir, filename)
        pdf.output(filepath, 'F')
        
        return filepath
