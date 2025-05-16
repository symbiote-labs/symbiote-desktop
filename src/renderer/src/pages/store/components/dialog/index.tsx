import { useDialogManager } from './DialogManagerContext'
import InstallDialog from './InstallDialog'
// Import other dialog components here as they are created
// e.g., import ItemDetailsDialog from './ItemDetailsDialog';

export default function DialogManager() {
  // Renamed component for clarity
  const { activeDialog, closeDialog } = useDialogManager()

  if (!activeDialog) {
    return null // No dialog is active
  }

  switch (activeDialog.type) {
    case 'install':
      return (
        <InstallDialog
          item={activeDialog.item} // item is guaranteed by activeDialog structure
          isOpen={true} // If we are rendering, it means this dialog should be open
          onClose={closeDialog}
        />
      )
    // case 'viewDetails':
    //   return (
    //     <ItemDetailsDialog
    //       item={activeDialog.item}
    //       isOpen={true}
    //       onClose={closeDialog}
    //     />
    //   );
    // Add more cases for other dialog types here
    default:
      console.warn('Unknown dialog type:', activeDialog.type)
      return null
  }
}
