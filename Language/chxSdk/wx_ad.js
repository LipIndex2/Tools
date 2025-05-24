//激励视频广告
class RewardAd {
  #adUnitId = null;
  constructor(adUnitId, status) {
    this.#adUnitId = adUnitId; // 广告ID
    this.ad = null; // 激励视频广告实例
    this.isLoaded = false; // 是否加载成功
    this.status = status; //启用状态; 2禁用 1启用
  }

  get isInit() {
    return this.ad != null
  }

  get type() {
    return 'reward'
  }

  init({
    successCallback,
    errorCallback,
    onClose,
  }) {
    if (this.isInit) {
      this.ad.offLoad();
      this.ad.offError();
      this.ad.offClose();
    } else {
      this.ad = wx.createRewardedVideoAd({
        adUnitId: this.#adUnitId,
        disableFallbackSharePage: true,
      })
    }
    this.ad.onLoad(() => {
      this.isLoaded = true;
      if (typeof successCallback === 'function') {
        successCallback();
      }
    })
    this.ad.onError(err => {
      this.isLoaded = false;
      if (typeof errorCallback === 'function') {
        errorCallback(err);
      }
    })
    this.ad.onClose(res => {
      this.isLoaded = false;
      if (res && res.isEnded || res === undefined) {
        if (typeof onClose === 'function') {
          onClose(1);
        }
      } else {
        if (typeof onClose === 'function') {
          onClose(2);
        }
      }
    });
  }

  onClose(onCloseCallback) {
    this.ad.offClose();
    this.ad.onClose(res => {
      this.isLoaded = false;
      if (typeof onCloseCallback === 'function') {
        if (res && res.isEnded || res === undefined) {
          onCloseCallback(1);
        } else {
          onCloseCallback(2);
        }
      }
    });
  }

  destroy() {
    if (this.ad) {
      this.ad.destroy()
      this.ad = null; // 清空广告实例
      this.isLoaded = false;
      console.log('chxsdk.destroyRewardedVideoAd', '广告已销毁');
    } else {
      console.warn('chxsdk.destroyRewardedVideoAd', '没有可销毁的广告');
    }
  }
}
//插屏广告
class InterAd {
  #adUnitId = null;
  constructor(adUnitId, status) {
    this.#adUnitId = adUnitId; // 广告ID
    this.ad = null; // 插屏广告实例
    this.isLoaded = false; // 是否加载成功
    this.status = status; //启用状态; 2禁用 1启用
  }

  get type() {
    return 'inter'
  }

  get isInit() {
    return this.ad != null
  }

  /**
   * 创建插屏广告
   * @successCallback 加载成功
   * @errorCallback 加载失败 如果加载失败，可以使用load手动重新拉取广告
   * @closeCallback 关闭广告
   */
  init({
    successCallback,
    errorCallback,
    closeCallback
  }) {
    if (this.ad) {
      this.ad.offLoad()
      this.ad.offError()
      this.ad.offClose()
      this.ad = null
    } else {
      this.ad = wx.createInterstitialAd({
        adUnitId: this.#adUnitId
      })
    }
    this.ad.onLoad(() => {
      this.isLoaded = true;
      if (typeof successCallback === 'function') {
        successCallback();
      }
    })
    this.ad.onError(err => {
      this.isLoaded = false;
      if (typeof errorCallback === 'function') {
        errorCallback(err);
      }
    })
    this.ad.onClose(() => {
      this.isLoaded = false;
      if (typeof closeCallback === 'function') {
        closeCallback();
      }
    });
  }

  onClose(closeCallback) {
    this.ad.offClose();
    this.ad.onClose(() => {
      if (typeof closeCallback === 'function') {
        closeCallback();
      }
    });
  }

  destroy() {
    if (this.ad) {
      this.ad.destroy();
      this.ad = null;
      this.isLoaded = false;
      console.log('chxsdk.destroyInterAd', '广告已销毁');
    } else {
      console.warn('chxsdk.destroyInterAd', '没有可销毁的广告');
    }
  }
}
//原生模板广告
class CustomAd {
  #adUnitId = null;
  constructor(adUnitId, status) {
    this.#adUnitId = adUnitId; // 广告ID
    this.ad = null; // 原生模板广告实例
    this.isLoaded = false; // 是否加载成功
    this.status = status; //启用状态; 2禁用 1启用
  }

  get type() {
    return 'origin'
  }

  get isInit() {
    return this.ad != null
  }

  get isShow() {
    if (this.ad) {
      return this.ad.isShow()
    }
    return false;
  }

  init({
    style,
    successCallback,
    errorCallback,
    closeCallback,
    hideCallback
  }) {
    if (this.ad) {
      this.ad.offLoad()
      this.ad.offError()
      this.ad.offClose()
      this.ad.offHide()
    } else {
      this.ad = wx.createCustomAd({
        adUnitId: this.#adUnitId,
        style: style
      })
    }
    this.ad.onLoad(() => {
      this.isLoaded = true;
      if (typeof successCallback === 'function') {
        successCallback();
      }
    })
    this.ad.onError(err => {
      this.isLoaded = false;
      if (typeof errorCallback === 'function') {
        errorCallback(err);
      }
    })
    this.ad.onClose(() => {
      if (typeof closeCallback === 'function') {
        closeCallback();
      }
    })
    this.ad.onHide(() => {
      if (typeof hideCallback === 'function') {
        hideCallback();
      }
    });
  }

  hide() {
    console.log('this.ad', this.ad);
    console.log('this.isShow', this.isShow);
    if (this.ad && this.isShow) {
      this.ad.hide();
      console.log('chxsdk.hideCustomAd', '广告已隐藏');
    } else {
      console.warn('chxsdk.hideCustomAd', '没有可隐藏的广告');
    }
  }

  /**
   * 销毁原生模板广告
   */
  destroy() {
    if (this.ad) {
      this.ad.destroy();
      this.ad = null; // 清空广告实例
      this.isLoaded = false;
      console.log('chxsdk.destroyCustomAd', '广告已销毁');
    } else {
      console.warn('chxsdk.destroyCustomAd', '没有可销毁的广告');
    }
  }
}

export {
  RewardAd,
  InterAd,
  CustomAd
};