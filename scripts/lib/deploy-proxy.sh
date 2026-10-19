#!/usr/bin/env bash

configure_deploy_proxy() {
  local enabled=${DEPLOY_USE_PROXY:-false}
  local host=${DEPLOY_PROXY_HOST:-127.0.0.1}
  local socks_port=${DEPLOY_PROXY_PORT:-1080}
  local http_port=${DEPLOY_HTTP_PROXY_PORT:-1087}

  [[ $enabled == true || $enabled == false ]] || {
    echo 'DEPLOY_USE_PROXY 只能是 true 或 false。' >&2
    return 1
  }

  if [[ $enabled == true ]]; then
    [[ $host =~ ^[A-Za-z0-9._:-]+$ ]] || {
      echo 'DEPLOY_PROXY_HOST 格式不正确。' >&2
      return 1
    }
    [[ $socks_port =~ ^[0-9]+$ && $http_port =~ ^[0-9]+$ ]] || {
      echo '部署代理端口必须是整数。' >&2
      return 1
    }
    (( socks_port >= 1 && socks_port <= 65535 && http_port >= 1 && http_port <= 65535 )) || {
      echo '部署代理端口必须位于 1..65535。' >&2
      return 1
    }
    export all_proxy="socks5://$host:$socks_port" ALL_PROXY="socks5://$host:$socks_port"
    export http_proxy="http://$host:$http_port" HTTP_PROXY="http://$host:$http_port"
    export https_proxy="http://$host:$http_port" HTTPS_PROXY="http://$host:$http_port"
    export no_proxy="127.0.0.1,localhost" NO_PROXY="127.0.0.1,localhost"
    echo "部署网络代理已启用：http://$host:$http_port，socks5://$host:$socks_port"
  else
    unset all_proxy ALL_PROXY http_proxy HTTP_PROXY https_proxy HTTPS_PROXY no_proxy NO_PROXY
    echo '部署网络代理未启用。'
  fi
}
