import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import ColoredIcon from './ColoredIcon';
import RichText from './RichText';

function AnswerFeedback({ isCorrect, explanation, correctAnswer, userAnswer }) {
  return (
    <div className={`mt-8 p-6 md:p-8 border-4 transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in ${
      isCorrect 
        ? 'border-foreground bg-background' 
        : 'border-destructive bg-background'
    }`}>
      <div className="flex flex-col sm:flex-row items-start gap-6">
        {isCorrect ? (
          <ColoredIcon icon={CheckCircle2} name="checkcircle2" size={12} />
        ) : (
          <ColoredIcon icon={XCircle} name="xcircle" size={12} />
        )}
        
        <div className="flex-1 space-y-4">
          <h3 className={`text-3xl font-black uppercase tracking-tight ${isCorrect ? 'text-foreground' : 'text-destructive'}`}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </h3>
          
          {!isCorrect && (
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
              <div className="space-y-1">
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your Answer</p>
                <p className="text-xl font-black text-destructive">{userAnswer}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Correct Answer</p>
                <p className="text-xl font-black text-foreground">{correctAnswer}</p>
              </div>
            </div>
          )}
          
          <div className="pt-4 border-t-2 border-border">
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Solution & Explanation
            </p>
            <div className="text-lg leading-relaxed font-medium">
              <RichText>{explanation}</RichText>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnswerFeedback;