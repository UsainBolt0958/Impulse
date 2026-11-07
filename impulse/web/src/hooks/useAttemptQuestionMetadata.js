import { useEffect, useMemo, useState } from 'react';
import { loadPublicQuestionMetadata } from '@/lib/portalServer';

const QUESTION_METADATA_FIELDS = ['exam', 'subject', 'chapter', 'difficulty'];

export function useAttemptQuestionMetadata(attempts) {
  const questionIds = useMemo(() => [...new Set(
    attempts
      .filter((attempt) => (
        attempt?.question_id
        && QUESTION_METADATA_FIELDS.some((field) => !attempt[field])
      ))
      .map((attempt) => String(attempt.question_id))
  )].sort(), [attempts]);
  const requestKey = questionIds.join('\u001f');
  const [metadataById, setMetadataById] = useState({});

  useEffect(() => {
    let active = true;
    if (!questionIds.length) {
      setMetadataById({});
      return () => {
        active = false;
      };
    }

    loadPublicQuestionMetadata(questionIds)
      .then((metadata) => {
        if (active) setMetadataById(metadata);
      })
      .catch((error) => {
        console.error('Could not load question metadata for study history.', error);
      });

    return () => {
      active = false;
    };
  }, [requestKey]);

  return metadataById;
}
