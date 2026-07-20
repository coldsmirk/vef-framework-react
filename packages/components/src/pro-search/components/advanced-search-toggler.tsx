import { motion } from "@vef-framework-react/core";
import { ChevronDownIcon } from "lucide-react";
import { memo } from "react";

import { Button } from "../../button";
import { Icon } from "../../icon";
import * as styles from "../styles";

interface AdvancedSearchTogglerProps {
  isVisible: boolean;
  onToggle: () => void;
}

export const AdvancedSearchToggler = memo(({ isVisible, onToggle }: AdvancedSearchTogglerProps) => (
  <Button
    css={styles.advancedSearchToggler}
    iconPlacement="end"
    type="link"
    icon={(
      <motion.div
        animate={{ rotate: isVisible ? -180 : 0 }}
        initial={false}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <Icon component={ChevronDownIcon} />
      </motion.div>
    )}
    onClick={onToggle}
  >
    高级搜索
  </Button>
));

AdvancedSearchToggler.displayName = "AdvancedSearchToggler";
