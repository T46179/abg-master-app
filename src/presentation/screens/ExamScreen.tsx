import { FileCheck } from "lucide-react";
import { TeaserPanel } from "../primitives/TeaserPanel";

export function ExamScreen() {
  return (
    <TeaserPanel
      title="Exam Mode Coming Soon"
      description="Test your knowledge with timed exams and comprehensive assessments. Track your progress and identify areas for improvement."
      icon={FileCheck}
      featureLabel="Feature Under Development"
      items={[
        { title: "Timed Exams", description: "Practice under pressure" },
        { title: "Performance Analytics", description: "Detailed score breakdowns" },
        { title: "Custom Exams", description: "Choose difficulty and topics" },
        { title: "Certifications", description: "Earn completion badges" }
      ]}
    />
  );
}
