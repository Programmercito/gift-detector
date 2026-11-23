type GiftEvent = {
    diamondCount?: number;
    giftDetails?: { diamondCount?: number; giftType?: number; giftName?: string };
    gift?: { diamondCount?: number; type?: number; gift_type?: number; name?: string };
    giftType?: number;
    giftName?: string;
    giftId?: string | number;
    repeatCount?: number;
    repeatEnd?: boolean | number;
};

export function isCompleteGiftEvent(event: GiftEvent): boolean {
    const giftType = Number(
        event.gift?.type ?? event.gift?.gift_type ?? event.giftDetails?.giftType ?? event.giftType ?? 0,
    );
    const repeatEnded = event.repeatEnd === true || event.repeatEnd === 1;
    return giftType !== 1 || repeatEnded;
}

export function getGiftCount(event: GiftEvent): number {
    const repeatCount = Number(event.repeatCount ?? 1);
    return Number.isFinite(repeatCount) && repeatCount > 0 ? Math.floor(repeatCount) : 1;
}

export function getGiftName(event: GiftEvent): string | undefined {
    const name = event.giftDetails?.giftName ?? event.gift?.name ?? event.giftName;
    if (typeof name === 'string' && name.trim()) return name.trim();
    if (event.giftId !== undefined) return `Regalo ${event.giftId}`;
    return undefined;
}

export function getReceivedDiamonds(event: GiftEvent): number {
    const diamondCount = Number(event.giftDetails?.diamondCount ?? event.gift?.diamondCount ?? event.diamondCount ?? 0);
    const repeatCount = getGiftCount(event);

    // Streak updates are cumulative, so intermediate updates must not be added.
    if (!isCompleteGiftEvent(event)) return 0;
    if (!Number.isFinite(diamondCount) || !Number.isFinite(repeatCount) || diamondCount <= 0 || repeatCount <= 0) {
        return 0;
    }

    return diamondCount * repeatCount;
}
