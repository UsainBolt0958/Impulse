import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import ColoredIcon from '@/components/ColoredIcon';

function Spinner({
  className,
  ...props
}) {
  return (
    <ColoredIcon icon={Loader2Icon} name="loader" size={4} className={cn("animate-spin", className)} {...props} />
  );
}

export { Spinner }