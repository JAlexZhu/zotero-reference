class CopyHelper {
  transferable: any;
  clipboardService: any;

  constructor() {
    this.transferable = Components.classes[
      "@mozilla.org/widget/transferable;1"
    ].createInstance(Components.interfaces.nsITransferable);
    this.clipboardService = Components.classes[
      "@mozilla.org/widget/clipboard;1"
    ].getService(Components.interfaces.nsIClipboard);
  }

  public addText(source: string, type: "text/html" | "text/unicode") {
    const str = Components.classes[
      "@mozilla.org/supports-string;1"
    ].createInstance(Components.interfaces.nsISupportsString);
    str.data = source;
    this.transferable.addDataFlavor(type);
    this.transferable.setTransferData(type, str, source.length * 2);
    return this;
  }

  // Only Windows
  public addImage(source: string) {
    const io = Components.classes[
      "@mozilla.org/network/io-service;1"
    ].getService(Components.interfaces.nsIIOService);
    const channel = io.newChannel(source, null, null);
    const input = channel.open();
    const imgTools = Components.classes[
      "@mozilla.org/image/tools;1"
    ].getService(Components.interfaces.imgITools);

    const buffer = NetUtil.readInputStreamToString(input, input.available());
    const container = imgTools.decodeImageFromBuffer(
      buffer,
      buffer.length,
      channel.contentType
    );

    this.transferable.addDataFlavor(channel.contentType);
    this.transferable.setTransferData(channel.contentType, container, -1);
    return this;
  }

  public copy() {
    this.clipboardService.setData(
      this.transferable,
      null,
      Components.interfaces.nsIClipboard.kGlobalClipboard
    );
  }
}

export { CopyHelper }