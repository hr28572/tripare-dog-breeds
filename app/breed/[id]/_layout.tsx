import { BreedDetailLayout } from '@/screens/BreedDetailLayout';
import { BreedErrorBoundary } from '@/screens/breed-detail/BreedErrorBoundary';

// Route-level error boundary: a bad id or render error stays on this screen.
export { BreedErrorBoundary as ErrorBoundary };

export default BreedDetailLayout;
