import { config } from "../../package.json";
import { getString, initLocale } from "../modules/locale";
import TipUI from "./tip";
import Utils from "./utils";
import LocalStroge from "E:/Github/zotero-style/src/modules/localSorage";
const localStroage = new LocalStroge(config.addonRef);
// import AddonItem from "E:/Github/zotero-style/src/modules/item";

// Zotero._AddonItemGlobal = Zotero._AddonItemGlobal || new AddonItem()
// const addonItem: AddonItem = Zotero._AddonItemGlobal

export default class Views {
  private utils!: Utils;
  private iconStyles = {
    bacogroundColor: "none",
    backgroundSize: "16px 16px",
    backgroundRepeat: "no-repeat",
    backgroundPositionX: "center",
    backgroundPositionY: "center",
    backgroundClip: "border-box",
    backgroundOrigin: "padding-box",
    width: "16px",
    "margin-inline-start": "0px",
    "margin-inline-end": "0px",
    marginTop: "0px",
    marginBottom: "0px",
  };
  constructor() {
    initLocale();
    this.utils = new Utils()
  }

  public async onInit() {
    ztoolkit.ReaderTabPanel.register(
      getString("tabpanel.reader.tab.label"),
      (
        panel: XUL.TabPanel | undefined,
        deck: XUL.Deck,
        win: Window,
        reader: _ZoteroTypes.ReaderInstance
      ) => {
        if (!panel) {
          ztoolkit.log(
            "This reader do not have right-side bar. Adding reader tab skipped."
          );
          return;
        }
        ztoolkit.log(reader);
        let timer: number|undefined
        const relatedbox = ztoolkit.UI.createElement(
          document,
          "relatedbox",
          {
            id: `${config.addonRef}-${reader._instanceID}-extra-reader-tab-div`,
            classList: ["zotero-editpane-related"],
            namespace: "xul",
            ignoreIfExists: true,
            attributes: {
              flex: "1",
            },
            children: [
              {
                tag: "vbox",
                namespace: "xul",
                classList: ["zotero-box"],
                attributes: {
                  flex: "1",
                },
                styles: {
                  paddingLeft: "0px",
                  paddingRight: "0px"
                },
                children: [
                  {
                    tag: "hbox",
                    namespace: "xul",
                    attributes: {
                      align: "center"
                    },
                    children: [
                      {
                        tag: "label",
                        namespace: "xul",
                        id: "referenceNum",
                        attributes: {
                          value: `0 ${getString("relatedbox.number.label")}`
                        },
                        listeners: [
                          {
                            type: "dblclick",
                            listener: () => {
                              ztoolkit.log("dblclick: Copy all references")
                              let textArray: string[] = []
                              let labels = relatedbox.querySelectorAll("rows row box label")
                              labels.forEach((e: any) => {
                                textArray.push(e.value)
                              });
                              (new ztoolkit.ProgressWindow("Reference"))
                                .createLine({text: "Copy all references", type: "success"})
                                .show();
                              (new ztoolkit.Clipboard())
                                .addText(textArray.join("\n"), "text/unicode")
                                .copy();
                            }
                          }
                        ]
                      },
                      {
                        tag: "button",
                        namespace: "xul",
                        id: "refresh-button",
                        attributes: {
                          label: getString("relatedbox.refresh.label")
                        },
                        listeners: [
                          {
                            type: "mousedown",
                            listener: () => {
                              timer = window.setTimeout(async () => {
                                timer = undefined
                                // 不从本地储存读取
                                await this.refreshReferences(panel, false)
                              }, 1000)
                            }
                          },
                          {
                            type: "mouseup",
                            listener: async () => {
                              if (timer) {
                                window.clearTimeout(timer) 
                                timer = undefined
                                // 本地储存读取
                                await this.refreshReferences(panel)
                              }
                            }
                          }
                        ]
                      }
                    ]
                  },
                  {
                    tag: "grid",
                    namespace: "xul",
                    attributes: {
                      flex: "1"
                    },
                    children: [
                      {
                        tag: "columns",
                        namespace: "xul",
                        children: [
                          {
                            tag: "column",
                            namespace: "xul",
                            attributes: {
                              flex: "1"
                            }
                          },
                          {
                            tag: "column",
                            namespace: "xul",
                          },
                        ]
                      },
                      {
                        tag: "rows",
                        namespace: "xul",
                        id: "referenceRows"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        );
        panel.append(relatedbox);
        window.setTimeout(async () => {
          if (Zotero.Prefs.get(`${config.addonRef}.loadingRelated`)) {
            await this.loadingRelated();
          }
          if (Zotero.Prefs.get(`${config.addonRef}.modifyLinks`)) {
            this.modifyLinks(reader)
          }
        })
      },
      {
        targetIndex: Zotero.PDFTranslate ? 3 : -1,
        tabId: "zotero-reference",
      }
    )
  }

  /**
   * 刷新推荐相关
   * @param array 
   * @param node 
   * @returns 
   */
  public refreshRelated(array: ItemBaseInfo[], node: XUL.Element) {
    let totalNum = 0
    ztoolkit.log("refreshRelated", array)
    array.forEach(async (info: ItemBaseInfo, i: number) => {
      let row = this.addRow(node, array, i, false, false) as XUL.Element
      if (!row) { return }
      row.classList.add("only-title")
      totalNum += 1;
      let box = row.querySelector("box") as XUL.Box
      if (!row.querySelector(".zotero-clicky-minus")) {
        window.setTimeout(async () => {        
          box.style.opacity = ".5"
          let item = (await this.utils.searchLibraryItem(info)) as Zotero.Item;
          if (item) {
            box.style.opacity = "1";
            box.onclick = (event) => {
              if (event.button == 0) {
                this.utils.selectItemInLibrary(item)
              }
            }
          }
        })
      }
    })
    return totalNum
  }

  /**
 * Only item with DOI is supported
 * @returns 
 */
  async loadingRelated() {
    ztoolkit.log("loadingRelated");
    let item = this.utils.getItem() as Zotero.Item
    if (!item) { return }
    let itemDOI = item.getField("DOI") as string
    if (!itemDOI || !this.utils.isDOI(itemDOI)) {
      ztoolkit.log("Not DOI", itemDOI);
      return
    }
    let relatedbox = document
      .querySelector(`#${Zotero_Tabs.selectedID}-context`)!
      .querySelector("tabpanel:nth-child(3) relatedbox")! as any
    do {
      await Zotero.Promise.delay(50);
    }
    while (!relatedbox.querySelector('#relatedRows'));

    let node = relatedbox.querySelector('#relatedRows')!.parentNode as XUL.Element
    // 已经刷新过
    if (node.querySelector(".zotero-clicky-plus")) { return }
    let relatedArray = (await this.utils.API.getDOIRelatedArray(itemDOI)) as ItemBaseInfo[]
    relatedArray = item.relatedItems.map((key: string) => {
      let item = Zotero.Items.getByLibraryAndKey(1, key) as Zotero.Item
      return {
        identifiers: { DOI: item.getField("DOI") },
        authors: [],
        title: item.getField("title"),
        text: item.getField("title"),
        url: item.getField("url"),
        type: item.itemType,
        year: item.getField("year")
      } as ItemBaseInfo
    }).concat(relatedArray)
    let func = relatedbox.refresh
    relatedbox.refresh = () => {
      func.call(relatedbox)
      // #42，为Zotero相关条目添加悬浮提示
      // 把Zotero条目转化为Reference可识别形式
      node.querySelectorAll("rows row").forEach(e => e.remove())
      console.log(relatedArray)
      this.refreshRelated(relatedArray, node)
      node.querySelectorAll("box image.zotero-box-icon")
        .forEach((e: any) => {
          let label = ztoolkit.UI.createElement(
            document,
            "label",
            {
              namespace: "xul",
              styles: {
                backgroundImage: `url(${e.src})`,
                ...this.iconStyles
              }
            }
          )
          e.parentNode.replaceChild(label, e)
        })
    }
    relatedbox.refresh()
  }

  public modifyLinks(reader: _ZoteroTypes.ReaderInstance) {
    let id = window.setInterval(() => {
      let _window: any
      try {
        // @ts-ignore
        _window = reader._iframeWindow.wrappedJSObject
      } catch {
        return window.clearInterval(id)
      }
      _window.document
        .querySelectorAll(".annotationLayer a[href^='#']:not([modify])").forEach((a: any) => {
          let _a = a.cloneNode(true)
          _a.setAttribute("modify", "")
          a.parentNode.appendChild(_a)
          a.remove()
          _a.addEventListener("click", async (event: any) => {
            event.preventDefault()
            let href = _a.getAttribute("href")
            if (_window.secondViewIframeWindow == null) {
              await reader.menuCmd("splitHorizontally")
              while (
                !(
                  _window?.secondViewIframeWindow?.PDFViewerApplication?.pdfDocument
                )
              ) {
                await Zotero.Promise.delay(100)
              }
              await Zotero.Promise.delay(1000)
            }
            let dest = unescape(href.slice(1))
            ztoolkit.log(dest)
            try {
              dest = JSON.parse(dest)
            } catch { }
            // 有报错，#39 
            _window.secondViewIframeWindow.PDFViewerApplication
              .pdfViewer.linkService.goToDestination(dest)
          })
        })
    }, 100)
  }

  public async refreshReferences(panel: XUL.TabPanel, local: boolean = true) {
    Zotero.ProgressWindowSet.closeAll();
    let label = panel.querySelector("label#referenceNum") as XUL.Label;
    label.value = `${0} ${getString("relatedbox.number.label")}`;
    let source = panel.getAttribute("source")
    if (source) {
      if (local) {
        if (source == "PDF") {
          panel.setAttribute("source", "API")
        }
        if (source == "API") {
          panel.setAttribute("source", "PDF")
        }
      }
    } else {
      panel.setAttribute("source", Zotero.Prefs.get(`${config.addonRef}.prioritySource`))
    }

    // clear 
    panel.querySelectorAll("#referenceRows row").forEach(e => e.remove());
    panel.querySelectorAll("#zotero-reference-search").forEach(e => e.remove());

    let references: ItemBaseInfo[]
    let item = this.utils.getItem() as Zotero.Item
    let reader = this.utils.getReader();
    if (panel.getAttribute("source") == "PDF") {
      // 优先本地读取
      const key = "References-PDF"
      // references = local && addonItem.get(item, key)
      references = local && localStroage.get(item, key)

      localStroage
      if (references) {
        (new ztoolkit.ProgressWindow("[Local] PDF"))
          .createLine({ text: `${references.length} references`, type: "success"})
          .show()
      } else {
        references = await this.utils.PDF.getReferences(reader)
        if (Zotero.Prefs.get(`${config.addonRef}.savePDFReferences`)) {
          window.setTimeout(async () => {
            // await addonItem.set(item, key, references)
            await localStroage.set(item, key, references)
          })
        }
      }
    } else {
      // 不再适配知网，没有DOI直接退出
      let DOI = item.getField("DOI") as string
      if (!this.utils.isDOI(DOI)) {
        (new ztoolkit.ProgressWindow("[Fail] API"))
          .createLine({ text: `${DOI} is not DOI`, type: "fail" })
          .show()
        return
      }
      const key = "References-API"
      references = local && localStroage.get(item, key)
      if (references) {
        (new ztoolkit.ProgressWindow("[Local] API"))
          .createLine({ text: `${references.length} references`, type: "success" })
          .show()
      } else {
        const popupWin = new ztoolkit.ProgressWindow("[Pending] API", {closeTime: -1})
        popupWin
          .createLine({ text: "Request references..." , type: "default"})
          .show()
        references = (await this.utils.API.getDOIInfoByCrossref(DOI))?.references!
        if (Zotero.Prefs.get(`${config.addonRef}.saveAPIReferences`)) {
          window.setTimeout(async () => {
            references && await localStroage.set(item, key, references)
          })
        }
        popupWin.changeHeadline("[Done] API")
        popupWin.changeLine({ text: `${references.length} references`, type: "success" })
        popupWin.startCloseTimer(3000)
      }
    }

    const referenceNum = references.length

    references.forEach(async (reference: ItemBaseInfo, refIndex: number) => {
      let row = this.addRow(panel, references, refIndex)!;
      window.setTimeout(async () => {
        let localItem = (await this.utils.searchLibraryItem(reference)) as Zotero.Item
        let itemType = this.utils.getItemType(localItem)
        if (itemType) {
          reference._item = localItem;
          (row.querySelector("#item-type-icon") as XUL.Label).style.backgroundImage =
            `url(chrome://zotero/skin/treeitem-${itemType}@2x.png)`
        }
      }, 0)
      label.value = `${refIndex + 1}/${referenceNum} ${getString("relatedbox.number.label")}`;
    })

    label.value = `${referenceNum} ${getString("relatedbox.number.label")}`;
  }

  public addRow(node: XUL.Element, references: ItemBaseInfo[], refIndex: number, addPrefix: boolean = true, addSearch: boolean = true) {
    let reference = references[refIndex]
    let refText: string
    if (addPrefix) {
      refText = `[${refIndex + 1}] ${reference.text}`
    } else {
      refText = reference.text!
    }
    // 避免重复添加
    let toText = (s: string) => s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "") 
    if (
      [...node.querySelectorAll("row label")].find((e: any) => toText(e.value) == toText(refText))
    ) {
      return
    }
    // id描述
    let idText = (
      reference.identifiers
      && Object.values(reference.identifiers).length > 0
      && Object.keys(reference.identifiers)[0] + ": " + Object.values(reference.identifiers)[0]
    ) || "Reference"
    // 当前item
    let item = this.utils.getItem()!
    let alreadyRelated = this.utils.searchRelatedItem(item, reference)
    // TODO 可以设置
    let editTimer: number | undefined
    const row = ztoolkit.UI.createElement(
      document,
      "row",
      {
        namespace: "xul",
        children: [
          {
            tag: "box",
            id: "reference-box",
            namespace: "xul",
            classList: ["zotero-clicky"],
            listeners: [
              {
                type: "mouseup",
                listener: async (event: any) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (event.ctrlKey) {
                    window.clearTimeout(editTimer)
                    let URL = reference.url
                    if (!URL) {
                      const refText = reference.text!
                      let info: ItemBaseInfo = this.utils.refText2Info(refText);
                      const popupWin = (new ztoolkit.ProgressWindow("[Pending] Request URL From API", {closeTime: -1}))
                        .createLine({ text: refText, type: "default"})
                        .show()
                      if (this.utils.isChinese(refText)) {
                        URL = await this.utils.API.getCNKIURL(info.title!, info.authors[0])
                      } else {
                        let DOI = await (await this.utils.API.getTitleInfoByCrossref(refText))?.identifiers.DOI
                        URL = this.utils.identifiers2URL({ DOI })
                      }
                      popupWin.changeHeadline("[Done] Request URL From API")
                      popupWin.startCloseTimer(3000)
                    }
                    if (URL) {
                      (new ztoolkit.ProgressWindow("Launching URL"))
                        .createLine({ text: URL, type: "default"})
                        .show()
                      Zotero.launchURL(URL);
                    }
                  } else {
                    if (rows.querySelector("#reference-edit")) {return}
                    if (editTimer) {
                      window.clearTimeout(editTimer)
                      Zotero.ProgressWindowSet.closeAll()
                      this.utils.copyText((idText ? idText + "\n" : "") + refText, false);
                      (new ztoolkit.ProgressWindow("Reference"))
                        .createLine({ text: refText, type: "success" })
                        .show()
                    }
                  }
                }
              },
            ],
            children: [
              {
                tag: "label",
                id: "item-type-icon",
                namespace: "xul",
                classList: [],
                styles: {
                  backgroundImage: `url(chrome://zotero/skin/treeitem-${reference.type}@2x.png)`,
                  ...this.iconStyles
                }
              },
              {
                tag: "label",
                namespace: "xul",
                id: "reference-label",
                classList: ["zotero-box-label"],
                attributes: {
                  value: refText,
                  crop: "end",
                  flex: "1"
                },
                listeners: [
                  {
                    type: "mousedown",
                    listener: () => {
                      editTimer = window.setTimeout(() => {
                        editTimer = undefined
                        enterEdit()
                      }, 500);
                    }
                  }
                ]
              },
            ]
          },
          {
            tag: "label",
            id: "add-remove",
            namespace: "xul",
            attributes: {
              value: alreadyRelated ? "-" : "+"
            },
            classList: [
              "zotero-clicky",
              alreadyRelated ? "zotero-clicky-minus" : "zotero-clicky-plus"
            ]
          }
        ]
      }
    ) as XUL.Element

    let enterEdit = () => {
      let box = row.querySelector("#reference-box")! as XUL.Label
      let label = row.querySelector("#reference-label")! as XUL.Label
      label.style.display = "none"
      let textbox = ztoolkit.UI.createElement(
        document,
        "textbox",
        {
          id: "reference-edit",
          namespace: "xul",
          attributes: {
            value: addPrefix ? label.value.replace(/^\[\d+\]\s+/, "") : label.value,
            flex: "1",
            multiline: "true",
            rows: "4"
          },
          listeners: [
            {
              type: "blur",
              listener: async () => {
                await exitEdit()
              }
            }
          ]
        }
      ) as XUL.Textbox
      textbox.focus()
      label.parentNode.insertBefore(textbox, label)

      let exitEdit = async () => {
        // 界面恢复
        let inputText = textbox.value
        if (!inputText) { return }
        label.style.display = ""
        // textbox.style.display = "none"
        textbox.remove()
        // 保存结果
        if (inputText == reference.text) { return }
        label.value = `[${refIndex + 1}] ${inputText}`;
        references[refIndex] = { ...reference, ...{ identifiers: this.utils.getIdentifiers(inputText) }, ...{ text: inputText } }
        reference = references[refIndex]
        const key = `References-${node.getAttribute("source")}`
        // ztoolkit.Tool.setExtraField(item, key, JSON.stringify(references))
        window.setTimeout(async () => {
          await localStroage.set(item, key, references)
        })
      }

      let id = window.setInterval(async () => {
        let active = rows.querySelector(".active")
        if (active && active != box) {
          await exitEdit()
          window.clearInterval(id)
        }
      }, 100)
    }

    const label = row.querySelector("label#add-remove")! as XUL.Label
    let setState = (state: string = "") => {
      switch (state) {
        case "+":
          label.setAttribute("class", "zotero-clicky zotero-clicky-plus");
          label.setAttribute("value", "+");
          label.style.opacity = "1";
          break;
        case "-":
          label.setAttribute("class", "zotero-clicky zotero-clicky-minus");
          label.setAttribute("value", "-");
          label.style.opacity = "1";
          break
        case "":
          label.setAttribute("value", "");
          label.style.opacity = ".23";
          break
      }
    }

    let remove = async () => {
      ztoolkit.log("removeRelatedItem");
      const popunWin = new ztoolkit.ProgressWindow("Removing", {closeTime: -1})
        .createLine({ text: refText, type: "default" })
        .show()
      setState()

      let relatedItem = this.utils.searchRelatedItem(item, reference) as Zotero.Item
      if (!relatedItem) {
        popunWin.changeHeadline("Removed");
        (node.querySelector("#refresh-button") as XUL.Button).click()
        popunWin.startCloseTimer(3000)
        return
      }
      relatedItem.removeRelatedItem(item)
      item.removeRelatedItem(relatedItem)
      await item.saveTx()
      await relatedItem.saveTx()
      setState("+")
      popunWin.changeHeadline("Removed");
      popunWin.changeLine({ type: "success" })
      popunWin.startCloseTimer(3000)
    }

    let add = async (collections: undefined | number[] = undefined) => {
      // check DOI
      let refItem, source
      let info: ItemBaseInfo = this.utils.refText2Info(reference.text!);
      setState()
      let popupWin
      // 认为中文知网一定能解决
      if (this.utils.isChinese(info.title!) && Zotero.Jasminum) {
        popupWin = (new ztoolkit.ProgressWindow("CNKI", { closeTime: -1 }))
          .createLine({ text: info.title, type: "default" })
          .show()
        // search DOI in local
        refItem = await this.utils.searchLibraryItem(info)

        if (refItem) {
          source = "Local Item"
        } else {
          refItem = await this.utils.createItemByJasminum(info.title!, info.authors[0])
          source = "Created Item"
        }
        ztoolkit.log("addToCollection")
        for (let collectionID of (collections || item.getCollections())) {
          refItem.addToCollection(collectionID)
          await refItem.saveTx()
        }
      }
      // DOI or arXiv
      else {
        if (Object.keys(reference.identifiers).length == 0) {
          // 目前只能获取DOI
          popupWin = (new ztoolkit.ProgressWindow("[Pending] Request DOI From API", { closeTime: -1 }))
            .createLine({ text: info.title, type: "default" })
            .show()
          let DOI = await (await this.utils.API.getTitleInfoByCrossref(info.title!))?.identifiers.DOI as string
          if (!this.utils.isDOI(DOI)) {
            setState("+");
            popupWin.changeHeadline("[Fail] Request DOI From API")
            popupWin.changeLine({ text: "Error DOI", type: "fail" })
            popupWin.startCloseTimer(3000)
            return
          }
          popupWin.changeHeadline("[Done] Request DOI From API")
          reference.identifiers = { DOI }
        }
        popupWin ??= (new ztoolkit.ProgressWindow("", {closeTime: -1})).createLine({ text: info.title, type: "default" }).show()
        // done
        if (this.utils.searchRelatedItem(item, reference)) {
          popupWin.changeHeadline("Added")
          popupWin.changeLine({ type: "success" });
          popupWin.startCloseTimer(3000);
          (node.querySelector("#refresh-button") as XUL.Button).click();
          return
        }
        popupWin.changeHeadline("Adding")
        setState()
        // search DOI in local
        refItem = await this.utils.searchLibraryItem(reference)
        if (refItem) {
          source = "Local Item"
          for (let collectionID of (collections || item.getCollections())) {
            refItem.addToCollection(collectionID)
            await refItem.saveTx()
          }
        } else {
          source = "Created Item"
          try {
            refItem = await this.utils.createItemByZotero(reference.identifiers, (collections || item.getCollections()))
          } catch (e: any) {
            popupWin.changeHeadline(`Add ${source}`)
            popupWin.changeLine({ type: "fail" })
            popupWin.startCloseTimer(3000)
            setState("+")
            ztoolkit.log(e)
            return
          }
        }
      }
      // addRelatedItem
      ztoolkit.log("addRelatedItem")
      item.addRelatedItem(refItem)
      refItem.addRelatedItem(item)
      await item.saveTx()
      await refItem.saveTx()
      // button
      setState("-")
      popupWin.changeHeadline(`Added with ${source}`)
      popupWin.changeLine({ text: refItem.getField("title"), type: "success" })
      popupWin.startCloseTimer(3000)
      return row
    }

    let getCollectionPath = async (id: number) => {
      let path = []
      while (true) {
        let collection = await Zotero.Collections.getAsync(id) as any
        path.push(collection._name)
        if (collection._parentID) {
          id = collection._parentID
        } else {
          break
        }
      }
      return path.reverse().join("/")
    }

    let timer: undefined | number, tipUI: TipUI;
    const box = row.querySelector("#reference-box") as XUL.Box
    // 鼠标进入浮窗展示
    box.addEventListener("mouseenter", () => {
      if (!Zotero.Prefs.get(`${config.addonRef}.isShowTip`)) { return }
      box.classList.add("active")
      const refText = reference.text as string
      let timeout = parseInt(Zotero.Prefs.get(`${config.addonRef}.showTipAfterMillisecond`) as string)
      timer = window.setTimeout(async () => {
        let toTimeInfo = (t: string) => {
          if (!t) { return undefined }
          let info = (new Date(t)).toString().split(" ")
          return `${info[1]} ${info[3]}`
        }
        tipUI = new TipUI()
        tipUI.onInit(box)
        let getDefalutInfoByReference = async () => {
          let info: ItemInfo = {
            identifiers: {},
            authors: [],
            type: "",
            title: idText || "Reference",
            tags: [],
            text: refText,
            abstract: refText
          }
          return info
        }
        let coroutines: Promise<ItemInfo | undefined>[], prefIndex: number, according: string
        if (reference?.identifiers.arXiv) {
          according = "arXiv"
          coroutines = [
            getDefalutInfoByReference(),
            this.utils.API.getArXivInfo(reference.identifiers.arXiv)
          ]
          prefIndex = parseInt(Zotero.Prefs.get(`${config.addonRef}.${according}InfoIndex`) as string)
        } else if (reference?.identifiers.DOI) {
          according = "DOI"
          coroutines = [
            getDefalutInfoByReference(),
            this.utils.API.getDOIInfoBySemanticscholar(reference.identifiers.DOI),
            this.utils.API.getDOIInfoByCrossref(reference.identifiers.DOI)
          ]
          prefIndex = parseInt(Zotero.Prefs.get(`${config.addonRef}.${according}InfoIndex`) as string)
        } else {
          according = "Title"
          coroutines = [
            getDefalutInfoByReference(),
            this.utils.API.getTitleInfoByReadpaper(refText),
            this.utils.API.getTitleInfoByCrossref(refText),
            this.utils.API.getTitleInfoByCNKI(refText)
          ]
          prefIndex = parseInt(Zotero.Prefs.get(`${config.addonRef}.${according}InfoIndex`) as string)
        }
        ztoolkit.log("prefIndex", prefIndex)
        const sourceConfig = {
          arXiv: { color: "#b31b1b", tip: "arXiv is a free distribution service and an open-access archive for 2,186,475 scholarly articles in the fields of physics, mathematics, computer science, quantitative biology, quantitative finance, statistics, electrical engineering and systems science, and economics. Materials on this site are not peer-reviewed by arXiv." },
          readpaper: { color: "#1f71e0", tip: "论文阅读平台ReadPaper共收录近2亿篇论文、2.7亿位作者、近3万所高校及研究机构，几乎涵盖了全人类所有学科。科研工作离不开论文的帮助，如何读懂论文，读好论文，这本身就是一个很大的命题，我们的使命是：“让天下没有难读的论文”" },
          semanticscholar: { color: "#1857b6", tip: "Semantic Scholar is an artificial intelligence–powered research tool for scientific literature developed at the Allen Institute for AI and publicly released in November 2015. It uses advances in natural language processing to provide summaries for scholarly papers. The Semantic Scholar team is actively researching the use of artificial-intelligence in natural language processing, machine learning, Human-Computer interaction, and information retrieval." },
          crossref: { color: "#89bf04", tip: "Crossref is a nonprofit association of approximately 2,000 voting member publishers who represent 4,300 societies and publishers, including both commercial and nonprofit organizations. Crossref includes publishers with varied business models, including those with both open access and subscription policies." },
          DOI: { color: "#fcb426" },
          Zotero: { color: "#d63b3b", tip: "Zotero is a free, easy-to-use tool to help you collect, organize, cite, and share your research sources." },
          CNKI: { color: "#1b66e6", tip: "中国知网知识发现网络平台—面向海内外读者提供中国学术文献、外文文献、学位论文、报纸、会议、年鉴、工具书等各类资源统一检索、统一导航、在线阅读和下载服务。" }
        }
        for (let i = 0; i < coroutines.length; i++) {
          // 不阻塞
          window.setTimeout(async () => {
            let info = await coroutines[i]
            if (!info) { return }
            const tagDefaultColor = "#59C1BD"
            let tags = info.tags!.map((tag: object | string) => {
              if (typeof tag == "object") {
                return { color: tagDefaultColor, ...(tag as object) }
              } else {
                return { color: tagDefaultColor, text: tag }
              }
            }) as any || []
            // 展示当前数据源tag
            if (info.source) { tags.push({ text: info.source, ...sourceConfig[info.source as keyof typeof sourceConfig], source: info.source }) }
            // 展示可点击跳转链接tag
            if (info.identifiers.DOI) {
              let DOI = info.identifiers.DOI
              tags.push({ text: "DOI", color: sourceConfig.DOI.color, tip: DOI, url: info.url })
            }
            if (info.identifiers.arXiv) {
              let arXiv = info.identifiers.arXiv
              tags.push({ text: "arXiv", color: sourceConfig.arXiv.color, tip: arXiv, url: info.url })
            }
            if (info.identifiers.CNKI) {
              let url = info.identifiers.CNKI
              tags.push({ text: "URL", color: sourceConfig.CNKI.color, tip: url, url: info.url })
            }
            if (reference._item) {
              // 用本地Item更新数据
              tags.push({ text: "Zotero", color: sourceConfig.Zotero.color, tip: sourceConfig.Zotero.tip, item: reference._item })
            }
            // 添加
            tipUI.addTip(
              this.utils.Html2Text(info.title!)!,
              tags,
              [
                info.authors.slice(0, 3).join(" / "),
                [info?.primaryVenue, toTimeInfo(info.publishDate as string) || info.year]
                  .filter(e => e).join(" \u00b7 ")
              ].filter(s => s != ""),
              this.utils.Html2Text(info.abstract!)!,
              according,
              i,
              prefIndex
            )
          }, 0)
        }
      }, timeout);
    })

    box.addEventListener("mouseleave", () => {
      box.classList.remove("active")
      window.clearTimeout(timer);
      if (!tipUI) { return }
      const timeout = tipUI.removeTipAfterMillisecond
      tipUI.tipTimer = window.setTimeout(async () => {
        // 监测是否连续一段时间内无active
        for (let i = 0; i < timeout / 2; i++) {
          if (rows.querySelector(".active")) { return }
          await Zotero.Promise.delay(1 / 1000)
        }
        tipUI && tipUI.clear()
      }, timeout / 2)
    })

    label.addEventListener("click", async (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (label.value == "+") {
        if (event.ctrlKey) {
          let collection = ZoteroPane.getSelectedCollection();
          ztoolkit.log(collection)
          if (collection) {
            (new ztoolkit.ProgressWindow("Adding to collection"))
              .createLine({ text: `${await getCollectionPath(collection.id)}`, type: "default"})
              .show()
            await add([collection.id])
          } else {
            (new ztoolkit.ProgressWindow("Error"))
              .createLine({ text: "Please select your coolection and retry", type: "fail" })
              .show()
          }
        } else {
          await add()
        }
      } else if (label.value == "-") {
        await remove()
      }
    })

    row.append(box, label);
    const rows = node.querySelector("rows[id$=Rows]")!

    rows.appendChild(row);
    let referenceNum = rows.childNodes.length
    if (addSearch && referenceNum && !node.querySelector("#zotero-reference-search")) { this.addSearch(node) }
    return row
  }

  public addSearch(node: XUL.Element) {
    ztoolkit.log("addSearch")
    let textbox = document.createElement("textbox") as XUL.Textbox;
    textbox.setAttribute("id", "zotero-reference-search");
    textbox.setAttribute("type", "search");
    textbox.setAttribute("placeholder", getString("relatedbox.search.placeholder"))
    textbox.style.marginBottom = ".5em";
    textbox.addEventListener("input", (event: any) => {
      let text = (event.target as any).value
      ztoolkit.log(
        `ZoteroReference: source text modified to ${text}`
      );

      let keywords = text.split(/[ ,，]/).filter((e: any) => e)
      if (keywords.length == 0) {
        node.querySelectorAll("row").forEach((row: any) => row.style.display = "")
        return
      }
      node.querySelectorAll("row").forEach((row: any) => {
        let content = (row.querySelector("#reference-label") as any).value
        let isAllMatched = true;
        for (let i = 0; i < keywords.length; i++) {
          isAllMatched = isAllMatched && content.toLowerCase().includes(keywords[i].toLowerCase())
        }
        if (!isAllMatched) {
          row.style.display = "none"
        } else {
          row.style.display = ""
        }
      })

    });
    // @ts-ignore
    textbox._clearSearch = () => {
      textbox.value = "";
      node.querySelectorAll("row").forEach((row: any) => row.style.display = "")
    }
    node.querySelector("vbox")!.insertBefore(
      textbox,
      node.querySelector("vbox grid")
    )
  }
}