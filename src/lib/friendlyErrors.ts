export function toFriendlyError(message: string): string {
  const m = message.toLowerCase()

  if (m.includes('insufficient non-expired raw material') || m.includes('insufficient non-expired raw stock')) {
    return 'Not enough raw material in stock. Buy more or check expiry dates.'
  }
  if (m.includes('insufficient bulk')) {
    return 'Not enough bulk oil in this batch.'
  }
  if (m.includes('insufficient packaged stock')) {
    return 'Not enough packaged stock for this sale.'
  }
  if (m.includes('expired')) {
    return 'This batch has expired. Choose a newer batch.'
  }
  if (m.includes('payment account')) {
    return 'Please select a payment method.'
  }
  if (m.includes('not authenticated')) {
    return 'Please sign in again.'
  }
  if (m.includes('select customer for wholesale')) {
    return 'Please select a customer for wholesale sales.'
  }
  if (m.includes('add at least one item')) {
    return 'Add at least one product to the sale.'
  }
  if (m.includes('invalid amount')) {
    return 'Please enter a valid amount.'
  }
  if (m.includes('complete all fields')) {
    return 'Please fill in all required fields.'
  }

  return message
}
