import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import ColoredIcon from './ColoredIcon';
import RichText from './RichText';

function QuestionCard({ question, isSolved, state }) {
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-900 border-green-900';
      case 'Medium': return 'bg-yellow-100 text-yellow-900 border-yellow-900';
      case 'Hard': return 'bg-red-100 text-red-900 border-red-900';
      default: return 'bg-gray-100 text-gray-900 border-gray-900';
    }
  };

  return (
    <Link to={`/solve/${question.id}`} state={state}>
      <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer border-border">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="text-base font-medium leading-relaxed flex-1">
              <RichText>{question.question_text}</RichText>
              {(() => {
                const imageSrc = String(question.image || question.question_image || '').trim();
                return imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={question.image_alt || 'Question illustration'}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    className="mt-4 w-full max-h-[320px] rounded-2xl border border-border object-contain bg-background"
                  />
                ) : null;
              })()}
            </div>
            {isSolved && (
              <ColoredIcon icon={CheckCircle2} name="checkcircle2" size={5} />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={`font-bold text-xs uppercase tracking-wide border ${getDifficultyColor(question.difficulty)}`}>
              {question.difficulty}
            </Badge>
            <Badge variant="outline" className="font-bold text-xs uppercase tracking-wide">
              {question.exam}
            </Badge>
            <Badge variant="outline" className="font-bold text-xs uppercase tracking-wide">
              {question.subject}
            </Badge>
            <Badge variant="outline" className="font-bold text-xs uppercase tracking-wide">
              {question.chapter}
            </Badge>
            <Badge variant="outline" className="font-bold text-xs uppercase tracking-wide">
              {question.year}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default QuestionCard;