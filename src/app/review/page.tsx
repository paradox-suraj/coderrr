import { Metadata } from 'next';
import ReviewClient from './ReviewClient';

export const metadata: Metadata = {
  title: 'Review Queue — AlgoJeet Pro',
  description: 'Your spaced repetition review queue.',
};

export default function ReviewPage() {
  return <ReviewClient />;
}
